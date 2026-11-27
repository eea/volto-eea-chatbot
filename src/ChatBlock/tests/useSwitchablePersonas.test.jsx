import { renderHook, act } from '@testing-library/react-hooks';

import { useSwitchablePersonas } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useSwitchablePersonas';

const personas = {
  29: { id: 29, name: 'Research Assistant' },
  34: { id: 34, name: 'Climate Assistant' },
};

const okResponse = (id) => ({
  ok: true,
  json: () => Promise.resolve(personas[id]),
});

const notFound = () => ({
  ok: false,
  status: 404,
  statusText: 'Not Found',
  json: () => Promise.resolve({}),
});

let mockSignals;

function mockFetch(url, options = {}) {
  const id = url.split('/').pop();
  mockSignals.push(options.signal);
  return Promise.resolve(id === '34' ? notFound() : okResponse(id));
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useSwitchablePersonas', () => {
  beforeEach(() => {
    mockSignals = [];
    global.fetch = jest.fn(mockFetch);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('makes no request and settles when the configured list is empty', async () => {
    const { result } = renderHook(() => useSwitchablePersonas([]));

    await flush();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.personas).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches one persona per configured assistant, keeping the configured order', async () => {
    const { result } = renderHook(() => useSwitchablePersonas([29, 34]));

    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('/_da/persona/29');
    expect(global.fetch.mock.calls[1][0]).toBe('/_da/persona/34');
    expect(result.current.personas.map((p) => p.id)).toEqual([29]);
    expect(result.current.isLoading).toBe(false);
  });

  it('skips duplicate ids', async () => {
    renderHook(() => useSwitchablePersonas(['29', 29, 34]));

    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('/_da/persona/29');
    expect(global.fetch.mock.calls[1][0]).toBe('/_da/persona/34');
  });

  it('drops only the assistant that failed to load and warns about it', async () => {
    const { result } = renderHook(() => useSwitchablePersonas([29, 34]));

    await flush();

    expect(result.current.personas.map((p) => p.name)).toEqual([
      'Research Assistant',
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('34'),
      expect.anything(),
    );
  });

  it('does not refetch when the same ids are passed in a new array', async () => {
    const { rerender } = renderHook(({ ids }) => useSwitchablePersonas(ids), {
      initialProps: { ids: [29] },
    });

    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender({ ids: [29] });
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches nothing while disabled', async () => {
    const { result } = renderHook(() =>
      useSwitchablePersonas([29, 34], { disabled: true }),
    );

    await flush();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.personas).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('aborts in-flight requests on unmount', async () => {
    const { unmount } = renderHook(() => useSwitchablePersonas([29]));

    unmount();

    expect(mockSignals).toHaveLength(1);
    expect(mockSignals[0].aborted).toBe(true);
  });
  it('uses the records that arrived while another request is still pending', async () => {
    const never = new Promise(() => {});
    global.fetch = jest.fn((url) =>
      url.endsWith('/34')
        ? never
        : Promise.resolve(okResponse(url.split('/').pop())),
    );

    const { result } = renderHook(() => useSwitchablePersonas([29, 34]));

    await flush();

    expect(result.current.personas.map((p) => p.id)).toEqual([29]);
    // Still loading, because one record has not arrived.
    expect(result.current.isLoading).toBe(true);
  });
});
