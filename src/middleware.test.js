// Mock superagent
import middleware, { isPathAllowed, ALLOWED_PROXY_PATHS } from './middleware';

jest.mock('superagent', () => ({
  post: jest.fn().mockReturnValue({
    type: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({
        headers: { 'set-cookie': ['session=abc; Max-Age=3600'] },
      }),
    }),
  }),
}));

// Mock node-fetch - use require() to get the mock reference in tests
jest.mock('node-fetch', () => {
  const mockPipe = jest.fn();
  const mockJson = jest.fn().mockResolvedValue({});
  const fn = jest.fn().mockResolvedValue({
    status: 200,
    headers: {
      get: jest.fn().mockReturnValue('application/json'),
      raw: jest.fn().mockReturnValue({}),
    },
    json: mockJson,
    body: { pipe: mockPipe },
  });
  fn.__mockPipe = mockPipe;
  fn.__mockJson = mockJson;
  return fn;
});

// Mock fs with stream callbacks
const _mockOnCallbacks = {};
jest.mock('fs', () => {
  const mockReadStream = {
    on: jest.fn((event, cb) => {
      _mockOnCallbacks[event] = cb;
      return mockReadStream;
    }),
  };
  return {
    createReadStream: jest.fn(() => mockReadStream),
    createWriteStream: jest.fn(() => ({ write: jest.fn(), end: jest.fn() })),
    readFileSync: jest.fn(),
  };
});

describe('src/middleware', () => {
  let req, res, next, nodeFetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
    nodeFetch = require('node-fetch');
    nodeFetch.mockClear();
    nodeFetch.__mockPipe.mockClear();

    // Reset stream callbacks
    Object.keys(_mockOnCallbacks).forEach((k) => delete _mockOnCallbacks[k]);

    req = {
      url: '/_da/chat/send-message',
      method: 'POST',
      body: { message: 'hello' },
      ip: '127.0.0.1',
      headers: {},
    };
    res = {
      send: jest.fn(),
      set: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns error when ONYX_API_KEY is missing', async () => {
    delete process.env.ONYX_API_KEY;
    await middleware(req, res, next);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Invalid configuration: missing ONYX api key',
    });
  });

  it('proxies POST request with api_key and pipes response', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';

    await middleware(req, res, next);

    expect(nodeFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/chat/send-message',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
        body: JSON.stringify({ message: 'hello' }),
      }),
      { message: 'hello' },
    );
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(nodeFetch.__mockPipe).toHaveBeenCalledWith(res);
  });

  it('handles related question paths', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_rq/chat/send-message';

    await middleware(req, res, next);

    expect(nodeFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/chat/send-message',
      expect.any(Object),
      expect.anything(),
    );
  });

  it('sends error response when fetch throws', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';

    nodeFetch.mockRejectedValueOnce(
      Object.assign(new Error('Network error'), {
        response: { text: 'Connection refused' },
      }),
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await middleware(req, res, next);

    expect(res.send).toHaveBeenCalledWith({
      error: 'Onyx error: Connection refused',
    });
    consoleSpy.mockRestore();
  });

  it('handles error without response text', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';

    nodeFetch.mockRejectedValueOnce(new Error('No response'));

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await middleware(req, res, next);

    expect(res.send).toHaveBeenCalledWith({
      error: 'Onyx error: error',
    });
    consoleSpy.mockRestore();
  });

  it('handles GET requests without body', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.method = 'GET';
    req.url = '/_da/persona/1';
    req.body = null;

    await middleware(req, res, next);

    const lastCall = nodeFetch.mock.calls[nodeFetch.mock.calls.length - 1];
    expect(lastCall[1].body).toBeUndefined();
  });

  // Express defaults to 200 when the proxy never sets a status, so every Onyx
  // error reached the browser as a success. The evidence client cannot tell a
  // missing chunk from a found one (or a gateway throttle from a response) unless
  // the upstream status survives the proxy.
  it('propagates an upstream 404 instead of flattening it to 200', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.method = 'GET';
    req.url = '/_da/document/chunk-info?document_id=doc-1&chunk_id=9';
    req.body = null;
    nodeFetch.mockResolvedValueOnce({
      status: 404,
      headers: {
        get: jest.fn().mockReturnValue('application/json'),
        raw: jest.fn().mockReturnValue({}),
      },
      body: { pipe: jest.fn() },
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('propagates an upstream 429 so the client can retry it', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.method = 'GET';
    req.url = '/_da/document/chunk-info?document_id=doc-1&chunk_id=0';
    req.body = null;
    nodeFetch.mockResolvedValueOnce({
      status: 429,
      headers: {
        get: jest.fn().mockReturnValue('application/json'),
        raw: jest.fn().mockReturnValue({}),
      },
      body: { pipe: jest.fn() },
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('answers 200 for a successful proxied chunk', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.method = 'GET';
    req.url = '/_da/document/chunk-info?document_id=doc-1&chunk_id=0';
    req.body = null;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses mock create-chat-session when MOCK_LLM_FILE_PATH is set', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    process.env.MOCK_LLM_FILE_PATH = '/tmp/mock.jsonl';
    req.url = '/_da/chat/create-chat-session';

    const middlewarePromise = middleware(req, res, next);
    jest.advanceTimersByTime(1000);
    await middlewarePromise.catch(() => {});

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(res.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
  });

  it('uses mock send-message with stream when MOCK_LLM_FILE_PATH is set', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    process.env.MOCK_LLM_FILE_PATH = '/tmp/mock.jsonl';
    req.url = '/_da/chat/send-message';

    const middlewarePromise = middleware(req, res, next);

    // Advance past the 2000ms mock delay
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    const fs = require('fs');
    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/mock.jsonl', {
      encoding: 'utf8',
    });

    // Simulate data event
    if (_mockOnCallbacks.data) {
      _mockOnCallbacks.data('{"ind":1}\n{"ind":2}\n');
    }

    // Simulate end event
    if (_mockOnCallbacks.end) {
      _mockOnCallbacks.end();
    }

    jest.advanceTimersByTime(5000);
    await middlewarePromise.catch(() => {});

    expect(res.write).toHaveBeenCalled();
  });

  it('dumps LLM response when DUMP_LLM_FILE_PATH is set', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    process.env.DUMP_LLM_FILE_PATH = '/tmp/dumped_response.jsonl';

    await middleware(req, res, next);

    const fs = require('fs');
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      '/tmp/dumped_response.jsonl',
    );
  });

  it('automatically sets sharing_status to public when create-chat-session succeeds', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    req.url = '/_da/chat/create-chat-session';
    req.method = 'POST';
    req.body = { persona_id: 1 };

    nodeFetch.mockImplementation(async (url, opts) => {
      if (url.includes('/chat/create-chat-session')) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({ chat_session_id: 'test-session-uuid-1234' }),
        };
      }
      if (url.includes('/chat/chat-session/test-session-uuid-1234')) {
        expect(opts.method).toBe('PATCH');
        expect(JSON.parse(opts.body)).toEqual({ sharing_status: 'public' });
        return { ok: true, status: 200 };
      }
      return { status: 200, headers: { get: () => 'application/json' } };
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      JSON.stringify({ chat_session_id: 'test-session-uuid-1234' }),
    );
  });

  it('enforces ?is_shared=true and returns sanitized public chat session', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    req.url = '/_da/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa';
    req.method = 'GET';
    req.body = undefined;

    const mockSession = {
      chat_session_id: '46277749-db60-44f2-9de1-c5dca2eb68fa',
      description: 'Shared Conversation Title',
      persona_id: 1,
      persona_name: 'EEA Assistant',
      shared_status: 'public',
      internal_secret_field: 'should-be-stripped',
      messages: [
        {
          message_id: 1,
          message_type: 'user',
          message: 'What is air quality?',
          parent_message: null,
          latest_child_message: 2,
          time_sent: '2026-11-05T00:00:00Z',
        },
        {
          message_id: 2,
          message_type: 'assistant',
          message: 'Air quality in Europe is improving [1].',
          parent_message: 1,
          latest_child_message: null,
          context_docs: [{ document_id: 'doc1', blurb: 'Blurb' }],
          citations: { 1: 'doc1' },
          time_sent: '2026-11-05T00:00:05Z',
        },
      ],
    };

    nodeFetch.mockImplementation(async (url) => {
      expect(url).toContain(
        '/api/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa?is_shared=true',
      );
      return {
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockSession),
      };
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const sentData = JSON.parse(res.send.mock.calls[0][0]);
    expect(sentData.chat_session_id).toBe(
      '46277749-db60-44f2-9de1-c5dca2eb68fa',
    );
    expect(sentData.internal_secret_field).toBeUndefined();
    expect(sentData.messages).toHaveLength(2);
  });

  it('returns 404 if shared_status is not public for get-chat-session', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    req.url = '/_da/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa';
    req.method = 'GET';

    nodeFetch.mockImplementation(async () => ({
      status: 200,
      headers: { get: () => 'application/json' },
      json: () =>
        Promise.resolve({
          chat_session_id: '46277749-db60-44f2-9de1-c5dca2eb68fa',
          shared_status: 'private',
        }),
    }));

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      JSON.stringify({ error: 'Conversation not found or private' }),
    );
  });

  it('stitches chained parent session messages and strips parent tag from description', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    const childSessionId = '22222222-2222-4222-8222-222222222222';
    const parentSessionId = '11111111-1111-4111-8111-111111111111';

    req.url = `/_da/chat/get-chat-session/${childSessionId}`;
    req.method = 'GET';

    nodeFetch.mockImplementation(async (url) => {
      if (url.includes(childSessionId)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: childSessionId,
              description: `Follow-up query [parent:${parentSessionId}]`,
              persona_id: 1,
              shared_status: 'public',
              messages: [
                {
                  message_id: 10,
                  message_type: 'user',
                  message: 'What about in Germany?',
                },
                {
                  message_id: 11,
                  message_type: 'assistant',
                  message: 'In Germany, air quality is monitored closely.',
                },
              ],
            }),
        };
      }
      if (url.includes(parentSessionId)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: parentSessionId,
              description: 'Initial Air Quality Discussion',
              persona_id: 1,
              shared_status: 'public',
              messages: [
                {
                  message_id: 1,
                  message_type: 'user',
                  message: 'What is air quality?',
                },
                {
                  message_id: 2,
                  message_type: 'assistant',
                  message: 'Air quality measures pollutants in the air.',
                },
              ],
            }),
        };
      }
      return { status: 404, headers: { get: () => 'application/json' } };
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const sentData = JSON.parse(res.send.mock.calls[0][0]);
    expect(sentData.chat_session_id).toBe(childSessionId);
    expect(sentData.description).toBe('Follow-up query');
    expect(sentData.messages).toHaveLength(4);
    expect(sentData.messages[0].message).toBe('What is air quality?');
    expect(sentData.messages[1].message).toBe(
      'Air quality measures pollutants in the air.',
    );
    expect(sentData.messages[2].message).toBe('What about in Germany?');
    expect(sentData.messages[3].message).toBe(
      'In Germany, air quality is monitored closely.',
    );
  });

  it('stops parent stitching safely when parent session is private', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    const childSessionId = '22222222-2222-4222-8222-222222222222';
    const privateParentId = '33333333-3333-4333-8333-333333333333';

    req.url = `/_da/chat/get-chat-session/${childSessionId}`;
    req.method = 'GET';

    nodeFetch.mockImplementation(async (url) => {
      if (url.includes(childSessionId)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: childSessionId,
              description: `Child [parent:${privateParentId}]`,
              persona_id: 1,
              shared_status: 'public',
              messages: [
                {
                  message_id: 10,
                  message_type: 'user',
                  message: 'Child question',
                },
              ],
            }),
        };
      }
      if (url.includes(privateParentId)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: privateParentId,
              shared_status: 'private',
              messages: [{ message_id: 1, message: 'Private secret' }],
            }),
        };
      }
      return { status: 404, headers: { get: () => 'application/json' } };
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const sentData = JSON.parse(res.send.mock.calls[0][0]);
    expect(sentData.messages).toHaveLength(1);
    expect(sentData.messages[0].message).toBe('Child question');
  });

  it('prevents infinite loops on cyclic parent session references', async () => {
    delete process.env.MOCK_LLM_FILE_PATH;
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://onyx.test';

    const sessionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const sessionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    req.url = `/_da/chat/get-chat-session/${sessionA}`;
    req.method = 'GET';

    nodeFetch.mockImplementation(async (url) => {
      if (url.includes(sessionA)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: sessionA,
              description: `Session A [parent:${sessionB}]`,
              persona_id: 1,
              shared_status: 'public',
              messages: [{ message_id: 1, message: 'Msg from A' }],
            }),
        };
      }
      if (url.includes(sessionB)) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              chat_session_id: sessionB,
              description: `Session B [parent:${sessionA}]`,
              persona_id: 1,
              shared_status: 'public',
              messages: [{ message_id: 2, message: 'Msg from B' }],
            }),
        };
      }
      return { status: 404, headers: { get: () => 'application/json' } };
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const sentData = JSON.parse(res.send.mock.calls[0][0]);
    // Should terminate gracefully and include both A and B without an infinite loop
    expect(sentData.messages).toHaveLength(2);
  });

  it('rejects disallowed paths with 404', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_da/admin/users/delete';
    req.method = 'POST';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(nodeFetch).not.toHaveBeenCalled();
  });

  it('rejects allowed path with wrong HTTP method', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_da/persona';
    req.method = 'DELETE';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(nodeFetch).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts', async () => {
    process.env.ONYX_API_KEY = 'test-key'; //betterleaks:allow
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_da/../../etc/passwd';
    req.method = 'GET';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(nodeFetch).not.toHaveBeenCalled();
  });
});

describe('isPathAllowed', () => {
  it('allows all defined _da proxy paths with correct methods', () => {
    expect(isPathAllowed('/persona', 'GET', ALLOWED_PROXY_PATHS)).toBe(true);
    expect(isPathAllowed('/persona/25', 'GET', ALLOWED_PROXY_PATHS)).toBe(true);
    expect(
      isPathAllowed('/chat/create-chat-session', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
    expect(
      isPathAllowed('/chat/send-message', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
    expect(
      isPathAllowed('/chat/send-chat-message', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
    expect(
      isPathAllowed(
        '/chat/create-chat-message-feedback',
        'POST',
        ALLOWED_PROXY_PATHS,
      ),
    ).toBe(true);
    expect(
      isPathAllowed(
        '/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa',
        'GET',
        ALLOWED_PROXY_PATHS,
      ),
    ).toBe(true);
  });

  it('rejects invalid UUIDs for get-chat-session', () => {
    expect(
      isPathAllowed(
        '/chat/get-chat-session/not-a-valid-uuid',
        'GET',
        ALLOWED_PROXY_PATHS,
      ),
    ).toBe(false);
    expect(
      isPathAllowed(
        '/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa',
        'POST',
        ALLOWED_PROXY_PATHS,
      ),
    ).toBe(false);
  });

  it('rejects allowed paths with wrong methods', () => {
    expect(isPathAllowed('/persona', 'POST', ALLOWED_PROXY_PATHS)).toBe(false);
    expect(
      isPathAllowed('/chat/send-message', 'GET', ALLOWED_PROXY_PATHS),
    ).toBe(false);
  });

  it('rejects disallowed paths', () => {
    expect(
      isPathAllowed('/admin/users/delete', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(false);
    expect(isPathAllowed('/../../etc/passwd', 'GET', ALLOWED_PROXY_PATHS)).toBe(
      false,
    );
    expect(isPathAllowed('/api/debug', 'GET', ALLOWED_PROXY_PATHS)).toBe(false);
  });

  it('strips query strings before comparison', () => {
    expect(
      isPathAllowed(
        '/persona?include_deleted=false',
        'GET',
        ALLOWED_PROXY_PATHS,
      ),
    ).toBe(true);
    expect(
      isPathAllowed('/persona/25?fields=name', 'GET', ALLOWED_PROXY_PATHS),
    ).toBe(true);
  });

  it('rejects non-numeric persona IDs', () => {
    expect(isPathAllowed('/persona/abc', 'GET', ALLOWED_PROXY_PATHS)).toBe(
      false,
    );
  });
});

describe('isPathAllowed with _rq paths', () => {
  it('allows related question paths via shared allowlist', () => {
    expect(
      isPathAllowed('/chat/create-chat-session', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
    expect(
      isPathAllowed('/chat/send-message', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
    expect(
      isPathAllowed('/chat/send-chat-message', 'POST', ALLOWED_PROXY_PATHS),
    ).toBe(true);
  });
});
