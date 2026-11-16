import { renderHook, act, waitFor } from '@testing-library/react';

import {
  useQualityMarkers,
  QUALITY_CHECK_OUTCOME,
  MAX_QUALITY_CHECK_ATTEMPTS,
} from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useQualityMarkers';

// Mock loadable before importing the hook
jest.mock('@loadable/component', () => {
  const loadable = () => {
    const MockComponent = () => null;
    return MockComponent;
  };
  loadable.lib = () => {
    const MockLibComponent = () => null;
    MockLibComponent.load = () =>
      Promise.resolve({ captureException: jest.fn() });
    return MockLibComponent;
  };
  return { __esModule: true, default: loadable };
});

const tick = () => new Promise((r) => setTimeout(r, 0));

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
});

const htmlResponse = (status = 503) => ({
  ok: false,
  status,
  headers: { get: () => 'text/html' },
  json: () => Promise.reject(new Error('Unexpected token <')),
});

const okBody = {
  claims: [{ startOffset: 0, endOffset: 12, score: 0.9, rationale: 'Ok' }],
  segments: {},
};

const MESSAGE = 'test message';
const SOURCES = [{ halloumiContext: 'source text', id: '1' }];

describe('useQualityMarkers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null markers when doQualityControl is false', () => {
    const { result } = renderHook(() => useQualityMarkers(false, MESSAGE, []));

    expect(result.current.markers).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.isLoadingHalloumi).toBe(false);
  });

  it('reports a no_sources failure instead of a synthetic verdict', async () => {
    const { result } = renderHook(() => useQualityMarkers(true, MESSAGE, []));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    // A fabricated claim carrying a fake rationale is what used to be rendered
    // as though the checker had produced it.
    expect(result.current.markers).toBeNull();
    expect(result.current.error.outcome).toBe(QUALITY_CHECK_OUTCOME.no_sources);
    expect(result.current.status).toBe('error');
  });

  it('fetches halloumi response when sources are provided', async () => {
    global.fetch.mockResolvedValue(jsonResponse(okBody));

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );

    await waitFor(() => expect(result.current.markers).not.toBeNull());

    expect(result.current.markers.claims).toHaveLength(1);
    expect(result.current.status).toBe('done');
    expect(result.current.isLoadingHalloumi).toBe(false);
  });

  it('passes an AbortController signal to fetch', async () => {
    global.fetch.mockResolvedValue(jsonResponse(okBody));

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.markers).not.toBeNull());

    const [, options] = global.fetch.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('classifies a 502 JSON envelope as unreachable', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(
        { error: 'Fact-checker unavailable', code: 'unreachable' },
        502,
      ),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(
      QUALITY_CHECK_OUTCOME.unreachable,
    );
    expect(result.current.markers).toBeNull();
  });

  it('classifies a 429 as busy and keeps retry_after', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({ error: 'busy', code: 'busy', retry_after: 30 }, 429),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(QUALITY_CHECK_OUTCOME.busy);
    expect(result.current.error.retryAfter).toBe(30);
  });

  it('classifies a non-JSON 503 as a timeout, not an outage', async () => {
    // The signature of Varnish cutting the connection at first_byte_timeout:
    // the checker was working, the answer was just too big to verify in time.
    global.fetch.mockResolvedValue(htmlResponse(503));

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(QUALITY_CHECK_OUTCOME.timeout);
  });

  it('treats a 200 with an error body as unreachable', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
        error: 'Invalid configuration: missing RAG_FACT_CHECKER_URL',
      }),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(
      QUALITY_CHECK_OUTCOME.unreachable,
    );
  });

  it('aborts and reports a timeout once the budget expires', async () => {
    global.fetch.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES, 0, undefined, 20),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(QUALITY_CHECK_OUTCOME.timeout);
    expect(result.current.status).toBe('error');
  });

  it('ignores a response that arrives after the user cancelled', async () => {
    let resolveFetch;
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );

    await waitFor(() => expect(result.current.isLoadingHalloumi).toBe(true));

    act(() => {
      result.current.cancelHalloumi();
    });

    act(() => {
      resolveFetch(jsonResponse(okBody));
    });
    await act(async () => {
      await tick();
      await tick();
    });

    expect(result.current.markers).toBeNull();
    expect(result.current.status).toBe('cancelled');
    expect(result.current.error).toBeNull();
  });

  it('does not leave an unhandled rejection when the network fails', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error.outcome).toBe(
      QUALITY_CHECK_OUTCOME.unreachable,
    );
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('caps retries, because every attempt is a real LLM run', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const { result } = renderHook(() =>
      useQualityMarkers(true, MESSAGE, SOURCES),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());

    for (let i = 0; i < MAX_QUALITY_CHECK_ATTEMPTS; i++) {
      act(() => {
        result.current.retryHalloumi();
      });
      await act(async () => {
        await tick();
        await tick();
      });
    }

    expect(result.current.failures).toBeGreaterThanOrEqual(
      MAX_QUALITY_CHECK_ATTEMPTS,
    );
    expect(result.current.canRetry).toBe(false);
  });

  it('filters out claims with special characters and low score', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
        claims: [
          { startOffset: 0, endOffset: 1, score: 0.01, rationale: 'Low' },
          { startOffset: 0, endOffset: 12, score: 0.9, rationale: 'Ok' },
        ],
        segments: {},
      }),
    );

    const { result } = renderHook(() =>
      useQualityMarkers(true, '* test message', SOURCES),
    );

    await waitFor(() => expect(result.current.markers).not.toBeNull());
    expect(result.current.markers.claims.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes retry, start and cancel callbacks', () => {
    const { result } = renderHook(() => useQualityMarkers(false, 'test', []));

    expect(typeof result.current.retryHalloumi).toBe('function');
    expect(typeof result.current.startHalloumi).toBe('function');
    expect(typeof result.current.cancelHalloumi).toBe('function');
  });
});
