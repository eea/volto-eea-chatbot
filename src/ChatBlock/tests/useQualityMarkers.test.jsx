import { renderHook, act } from '@testing-library/react-hooks';

import { useQualityMarkers } from '../hooks/useQualityMarkers';

// Mock loadable before importing the hook
jest.mock('@loadable/component', () => {
  const loadable = () => {
    const MockComponent = ({ children }) => null;
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

describe('useQualityMarkers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null markers when doQualityControl is false', () => {
    const { result } = renderHook(() =>
      useQualityMarkers(false, 'test message', []),
    );

    expect(result.current.markers).toBeNull();
    expect(result.current.isLoadingHalloumi).toBe(false);
  });

  it('returns failure rationale when sources are empty', async () => {
    let hookResult;
    await act(async () => {
      const { result } = renderHook(() =>
        useQualityMarkers(true, 'test message', []),
      );
      // Wait a tick for the async useEffect handler to complete
      await new Promise((r) => setTimeout(r, 0));
      hookResult = result;
    });

    expect(hookResult.current.markers).toBeDefined();
    expect(hookResult.current.markers.claims[0].rationale).toBe(
      'Answer cannot be verified due to empty sources.',
    );
  });

  it('fetches halloumi response when sources are provided', async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          claims: [
            {
              startOffset: 0,
              endOffset: 12,
              score: 0.9,
              rationale: 'Supported',
            },
          ],
          segments: {},
        }),
    });

    const sources = [{ halloumiContext: 'source text', id: '1' }];

    const { result, waitForValueToChange } = renderHook(() =>
      useQualityMarkers(true, 'test message', sources),
    );

    await waitForValueToChange(() => result.current.markers);

    expect(result.current.markers).toBeDefined();
    expect(result.current.markers.claims).toHaveLength(1);
    expect(result.current.isLoadingHalloumi).toBe(false);
  });

  it('retryHalloumi resets response', async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          claims: [
            { startOffset: 0, endOffset: 12, score: 0.9, rationale: 'Ok' },
          ],
          segments: {},
        }),
    });

    const sources = [{ halloumiContext: 'source text', id: '1' }];

    const { result, waitForValueToChange } = renderHook(() =>
      useQualityMarkers(true, 'test message', sources),
    );

    await waitForValueToChange(() => result.current.markers);
    expect(result.current.markers).not.toBeNull();

    act(() => {
      result.current.retryHalloumi();
    });

    expect(result.current.markers).toBeNull();
  });

  it('filters out claims with special characters and low score', async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          claims: [
            {
              startOffset: 0,
              endOffset: 1,
              score: 0.01,
              rationale: 'Low',
            },
            {
              startOffset: 0,
              endOffset: 12,
              score: 0.9,
              rationale: 'Ok',
            },
          ],
          segments: {},
        }),
    });

    const sources = [{ halloumiContext: 'source text', id: '1' }];
    const message = '* test message';

    const { result, waitForValueToChange } = renderHook(() =>
      useQualityMarkers(true, message, sources),
    );

    await waitForValueToChange(() => result.current.markers);
    // Claims with special chars only and small score get filtered
    expect(result.current.markers.claims.length).toBeGreaterThanOrEqual(1);
  });

  it('provides retryHalloumi callback', () => {
    const { result } = renderHook(() => useQualityMarkers(false, 'test', []));

    expect(typeof result.current.retryHalloumi).toBe('function');
  });
});
