import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { isPathAllowed } from '../middleware';

// Mock node-fetch
jest.mock('node-fetch');

describe('halloumi middleware', () => {
  let req, res, next, middleware;

  beforeEach(() => {
    fetch.mockReset();
    // Clear the module cache so middleware is re-imported with current env vars
    jest.resetModules();
    // Re-mock after reset
    jest.mock('node-fetch', () => jest.fn());

    req = new EventEmitter();
    Object.assign(req, {
      url: '/_ha/generate',
      method: 'POST',
      body: {
        sources: ['source1', 'source2'],
        answer: 'test answer',
      },
      headers: {},
      ip: '127.0.0.1',
    });
    res = {
      send: jest.fn(),
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('proxies request to rag-fact-checker and returns response', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    const mockResponse = {
      claims: [
        {
          startOffset: 0,
          endOffset: 20,
          segmentIds: ['0'],
          score: 0.95,
          rationale: 'Supported by source.',
        },
      ],
      segments: { 0: { startOffset: 0, endOffset: 30 } },
    };

    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await middleware(req, res, next);

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:8000/halloumi/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: 'test answer',
          sources: ['source1', 'source2'],
          max_context_segments: 0,
        }),
      }),
    );
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.send).toHaveBeenCalledWith(mockResponse);
  });

  it('returns 502 when rag-fact-checker is unreachable', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Fact-checker unavailable'),
      }),
    );
  });

  it('returns error when rag-fact-checker responds with non-ok status', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal server error' }),
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Internal server error'),
      }),
    );
  });

  it('rejects disallowed paths with 404', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;

    req.url = '/_ha/admin/config';
    req.method = 'POST';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
  });

  it('rejects allowed path with wrong HTTP method', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;

    req.url = '/_ha/generate';
    req.method = 'GET';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
  });

  it('uses default URL when RAG_FACT_CHECKER_URL is not set', async () => {
    delete process.env.RAG_FACT_CHECKER_URL;
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ claims: [], segments: {} }),
    });

    await middleware(req, res, next);

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:8000/halloumi/generate',
      expect.any(Object),
    );
  });

  it('bounds the upstream request with a timeout', async () => {
    // Without this, a hung checker pins an Express request - and a Varnish
    // worker - until Varnish gives up at 300s and answers with HTML.
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ claims: [], segments: {} }),
    });

    await middleware(req, res, next);

    const [, options] = mockedFetch.mock.calls[0];
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThan(300000);
  });

  it('returns a 504 timeout envelope when the upstream is too slow', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    const timeoutError = new Error('network timeout at: ...');
    timeoutError.name = 'FetchError';
    timeoutError.type = 'request-timeout';
    mockedFetch.mockRejectedValue(timeoutError);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'timeout' }),
    );
  });

  it('passes a rate limit through as a retryable busy response', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ detail: 'Too many requests' }),
    });

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'busy',
        retry_after: expect.any(Number),
      }),
    );
  });

  it('rejects excess checks instead of queueing them', async () => {
    // One replica, no HPA, and each check is a chain of LLM calls. Queuing is
    // how one chatty user makes everyone else wait minutes; rejecting fast lets
    // the UI say "busy".
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    const pending = [];
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );

    const resA = {
      ...res,
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const resB = {
      ...res,
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const resC = {
      ...res,
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    const pA = middleware(req, resA, next);
    const pB = middleware(req, resB, next);
    await middleware(req, resC, next);

    expect(resC.status).toHaveBeenCalledWith(503);
    expect(resC.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'busy' }),
    );
    // the rejected request never reached the checker at all
    expect(mockedFetch).toHaveBeenCalledTimes(2);

    expect(pending).toHaveLength(2);
    pending.forEach((resolve) =>
      resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ claims: [], segments: {} }),
      }),
    );
    await Promise.all([pA, pB]);
  });

  // Skipped where the environment has no AbortController at all - the proxy
  // degrades to uncancellable upstream there, by design.
  const itAbort = typeof AbortController === 'undefined' ? it.skip : it;

  itAbort('aborts the upstream check when the client disconnects', async () => {
    // The bug this guards: a browser-side Cancel says nothing to the checker,
    // which is already several LLM calls deep. The abandoned request kept
    // holding one of the two concurrency slots until it finished, so two
    // cancels wedged the service and every later check came back busy.
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    mockedFetch.mockImplementation(
      (url, opts) =>
        new Promise((resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const running = middleware(req, res, next);
    // The proxy reaches the upstream call synchronously, before its first
    // await, so the request exists by the time middleware() hands back a
    // promise. Asserted rather than assumed, so a regression reads as a failed
    // expectation instead of a TypeError on undefined.
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    req.emit('close');
    await running;

    const opts = mockedFetch.mock.calls[0][1];
    expect(opts.signal).toBeDefined();
    expect(opts.signal.aborted).toBe(true);
    // Nothing to answer, and a cancel must not be logged as an outage.
    expect(res.status).not.toHaveBeenCalled();
  });

  it('proxies /health so the UI can know the checker is down up front', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    req.url = '/_ha/health';
    req.method = 'GET';
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    await middleware(req, res, next);

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('reports /health as unavailable when the checker is unreachable', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = require('./middleware').default;
    const mockedFetch = require('node-fetch');

    req.url = '/_ha/health';
    req.method = 'GET';
    mockedFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unreachable' }),
    );
  });
});

describe('halloumi path allowlist', () => {
  const ALLOWED_HALLOUMI_PATHS = [
    { path: '/generate', methods: ['POST'] },
    { path: '/health', methods: ['GET'] },
  ];

  it('allows /health with GET', () => {
    expect(isPathAllowed('/health', 'GET', ALLOWED_HALLOUMI_PATHS)).toBe(true);
  });

  it('rejects /health with POST', () => {
    expect(isPathAllowed('/health', 'POST', ALLOWED_HALLOUMI_PATHS)).toBe(
      false,
    );
  });

  it('allows /generate with POST', () => {
    expect(isPathAllowed('/generate', 'POST', ALLOWED_HALLOUMI_PATHS)).toBe(
      true,
    );
  });

  it('rejects /generate with wrong method', () => {
    expect(isPathAllowed('/generate', 'GET', ALLOWED_HALLOUMI_PATHS)).toBe(
      false,
    );
  });

  it('rejects disallowed paths', () => {
    expect(isPathAllowed('/admin/config', 'POST', ALLOWED_HALLOUMI_PATHS)).toBe(
      false,
    );
    expect(
      isPathAllowed('/../../etc/passwd', 'POST', ALLOWED_HALLOUMI_PATHS),
    ).toBe(false);
  });
});
