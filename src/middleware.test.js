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
  const fn = jest.fn().mockResolvedValue({
    status: 200,
    headers: {
      get: jest.fn().mockReturnValue('application/json'),
      raw: jest.fn().mockReturnValue({}),
    },
    body: { pipe: mockPipe },
  });
  fn.__mockPipe = mockPipe;
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
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
    process.env.ONYX_URL = 'http://localhost:3000';
    req.method = 'GET';
    req.url = '/_da/persona/1';
    req.body = null;

    await middleware(req, res, next);

    const lastCall = nodeFetch.mock.calls[nodeFetch.mock.calls.length - 1];
    expect(lastCall[1].body).toBeUndefined();
  });

  it('uses mock create-chat-session when MOCK_LLM_FILE_PATH is set', async () => {
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
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
    process.env.ONYX_API_KEY = 'test-key';
    process.env.ONYX_URL = 'http://localhost:3000';
    process.env.DUMP_LLM_FILE_PATH = '/tmp/dumped_response.jsonl';

    await middleware(req, res, next);

    const fs = require('fs');
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      '/tmp/dumped_response.jsonl',
    );
  });

  it('rejects disallowed paths with 404', async () => {
    process.env.ONYX_API_KEY = 'test-key';
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_da/admin/users/delete';
    req.method = 'POST';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(nodeFetch).not.toHaveBeenCalled();
  });

  it('rejects allowed path with wrong HTTP method', async () => {
    process.env.ONYX_API_KEY = 'test-key';
    process.env.ONYX_URL = 'http://localhost:3000';
    req.url = '/_da/persona';
    req.method = 'DELETE';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
    expect(nodeFetch).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts', async () => {
    process.env.ONYX_API_KEY = 'test-key';
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
