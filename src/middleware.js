import superagent from 'superagent';
import fetch from 'node-fetch';
import debug from 'debug';

import fs from 'fs';

const log = debug('volto-eea-chatbot');
// import readline from 'readline';

const MOCK_STREAM_DELAY = parseInt(process.env.MOCK_STREAM_DELAY || '0');

let cached_auth_cookie = null;
let last_fetched = null;
let maxAge;

const MSG_INVALID_CONFIGURATION = 'Invalid configuration: missing ONYX api key';
const MSG_FETCH_COOKIE = 'Error while fetching authentication cookie';
const MSG_ERROR_REQUEST = 'Error in processing request to Onyx';

async function get_login_cookie(username, password) {
  const url = `${process.env.ONYX_URL}/api/auth/login`;
  const data = {
    username,
    password,
    scope: '',
    client_id: '',
    client_secret: '',
    grant_type: '',
  };
  try {
    const response = await superagent.post(url).type('form').send(data);
    const header = response.headers['set-cookie'][0];
    return header;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(MSG_FETCH_COOKIE, error);
  }
}

async function getAuthCookie(username, password) {
  cached_auth_cookie = await get_login_cookie(username, password);
  if (cached_auth_cookie) {
    const maxAgeMatch = cached_auth_cookie.match(/Max-Age=(\d+)/);
    maxAge = parseInt(maxAgeMatch[1]);
    last_fetched = new Date();
  }
}

async function login(username, password) {
  const diff = maxAge - (new Date() - last_fetched) / 1000;
  // eslint-disable-next-line no-console
  log('onyx auth still valid for seconds: ', diff);
  if (!cached_auth_cookie || diff < 0) {
    await getAuthCookie(username, password);
  }
}

async function check_credentials() {
  const reqUrl = `${process.env.ONYX_URL}/api/persona/-1`;

  const options = {
    method: 'GET',
    headers: {
      Cookie: cached_auth_cookie,
      'Content-Type': 'application/json',
    },
  };

  log(`Fetching ${reqUrl}`);
  return await fetch(reqUrl, options);
}

function mock_create_chat(res) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.write(`{"chat_session_id":"46277749-db60-44f2-9de1-c5dca2eb68fa"}`);
  res.end();
}

function mock_send_message(res, is_related_question) {
  const env_name = is_related_question
    ? 'MOCK_LLM_FILE_PATH_RQ'
    : 'MOCK_LLM_FILE_PATH';
  const filePath = process.env[env_name];
  if (!filePath) {
    log(`${env_name} is not set. Cannot mock send message.`);
    res.status(500).send(`Internal Server Error: ${env_name} not set.`);
    return;
  }
  const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });

  let buffer = '';
  let lineIndex = 0;

  // Set appropriate headers for streaming
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendLineWithDelay = (line, index) => {
    if (MOCK_STREAM_DELAY === 0) {
      res.write(line + '\n');
      log(`Sent line ${index + 1}: ${line.substring(0, 50)}...`);
      return;
    } else {
      setTimeout(() => {
        res.write(line + '\n');
        log(`Sent line ${index + 1}: ${line.substring(0, 50)}...`);
      }, index * MOCK_STREAM_DELAY);
    }
  };

  readStream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');

    // Keep the last incomplete line in buffer
    buffer = lines.pop() || '';

    // Process complete lines
    lines.forEach((line) => {
      if (line.trim()) {
        // Only send non-empty lines
        sendLineWithDelay(line.trim(), lineIndex);
        lineIndex++;
      }
    });
  });

  readStream.on('end', () => {
    // Handle any remaining content in buffer
    if (buffer.trim()) {
      sendLineWithDelay(buffer.trim(), lineIndex);
      lineIndex++;
    }

    // End the response after all lines are sent
    setTimeout(() => {
      res.end();
      log('File stream ended - all lines sent');
    }, lineIndex * MOCK_STREAM_DELAY);
  });

  readStream.on('error', (err) => {
    log('Error reading file:', err);
    res.status(500).send('Internal Server Error');
  });
}

async function send_onyx_request(
  req,
  res,
  { username, password, api_key, url, is_related_question },
) {
  const forwardedFor = req.headers['x-forwarded-for'] || req.ip;
  let headers = {};
  if (!api_key) {
    await login(username, password);

    try {
      const resp = await check_credentials();
      if (resp.status !== 200) {
        await getAuthCookie(username, password);
      }
    } catch (error) {
      await getAuthCookie(username, password);
    }
    headers = {
      Cookie: cached_auth_cookie,
      'Content-Type': 'application/json',
      'X-Forwarded-For': forwardedFor,
    };
  } else {
    headers = {
      Authorization: 'Bearer ' + api_key,
      'Content-Type': 'application/json',
      'X-Forwarded-For': forwardedFor,
    };
  }

  const options = {
    method: req.method,
    headers: headers,
  };

  if (req.body && req.method === 'POST') {
    options.body = JSON.stringify(req.body);
  }

  const mock_file = is_related_question
    ? process.env.MOCK_LLM_FILE_PATH_RQ
    : process.env.MOCK_LLM_FILE_PATH;

  if (mock_file && req.url.endsWith('send-message')) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      mock_send_message(res, is_related_question);
    } catch (e) {
      log(e);
    }
    return;
  }

  if (mock_file && req.url.endsWith('create-chat-session')) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    mock_create_chat(res);
    return;
  }

  try {
    log(`Fetching ${url}`);
    const response = await fetch(url, options, req.body);

    if (process.env.DUMP_LLM_FILE_PATH && !is_related_question) {
      const filePath = process.env.DUMP_LLM_FILE_PATH;
      const writer = fs.createWriteStream(filePath);
      response.body.pipe(writer);
      log(`Dumped LLM response to: ${filePath}`);
    }

    if (!api_key) {
      if (response.headers.get('transfer-encoding') === 'chunked') {
        res.set('Content-Type', 'text/event-stream');
      } else {
        res.set('Content-Type', 'application/json');
      }
    } else {
      res.set('Content-Type', response.headers.get('Content-Type'));
    }
    response.body.pipe(res);
  } catch (error) {
    throw error;
  }
}

export default async function middleware(req, res, next) {
  const is_related_question = req.url.includes('/_rq/');
  const path = req.url.replace('/_da/', '/').replace('/_rq/', '/');

  const reqUrl = `${process.env.ONYX_URL || ''}/api${path}`;

  const api_key = process.env.ONYX_API_KEY;
  if (!api_key) {
    res.statusCode = 500;
    res.statusMessage = MSG_INVALID_CONFIGURATION
    res.send({ error: MSG_INVALID_CONFIGURATION });
    return;
  }

  try {
    await send_onyx_request(req, res, {
      url: reqUrl,
      api_key: api_key,
      is_related_question,
    });
  } catch (error) {
    // eslint-disable-next-line
    const errorMessage = `Onyx error: ${error?.response?.text || 'error'}`
    console.error(MSG_ERROR_REQUEST, errorMessage);
    res.statusCode = 500;
    res.statusMessage = errorMessage;
    res.send({ error: errorMessage });
  }
}
