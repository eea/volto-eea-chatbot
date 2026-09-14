import { isPathAllowed } from '../middleware';

// Mock node-fetch — Vitest ESM interop: CJS modules must be mocked with a
// { default: ... } object, a bare function is not accepted (unlike Jest).
// The mock is created via vi.hoisted so every import (including re-imports
// after vi.resetModules()) sees the same instance.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('node-fetch', () => ({ default: fetchMock }));

describe('halloumi middleware', () => {
  let req, res, next, middleware;

  beforeEach(() => {
    fetchMock.mockReset();
    // Clear the module cache so middleware is re-imported with current env vars
    vi.resetModules();

    req = {
      url: '/_ha/generate',
      method: 'POST',
      body: {
        sources: ['source1', 'source2'],
        answer: 'test answer',
      },
      headers: {},
      ip: '127.0.0.1',
    };
    res = {
      send: vi.fn(),
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies request to rag-fact-checker and returns response', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = (await import('./middleware')).default;

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

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await middleware(req, res, next);

    expect(fetchMock).toHaveBeenCalledWith(
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
    middleware = (await import('./middleware')).default;

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

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
    middleware = (await import('./middleware')).default;

    fetchMock.mockResolvedValue({
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
    middleware = (await import('./middleware')).default;

    req.url = '/_ha/admin/config';
    req.method = 'POST';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
  });

  it('rejects allowed path with wrong HTTP method', async () => {
    process.env.RAG_FACT_CHECKER_URL = 'http://localhost:8000';
    middleware = (await import('./middleware')).default;

    req.url = '/_ha/generate';
    req.method = 'GET';

    await middleware(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Not Found' });
  });

  it('uses default URL when RAG_FACT_CHECKER_URL is not set', async () => {
    delete process.env.RAG_FACT_CHECKER_URL;
    middleware = (await import('./middleware')).default;

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ claims: [], segments: {} }),
    });

    await middleware(req, res, next);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/halloumi/generate',
      expect.any(Object),
    );
  });
});

describe('halloumi path allowlist', () => {
  const ALLOWED_HALLOUMI_PATHS = [{ path: '/generate', methods: ['POST'] }];

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