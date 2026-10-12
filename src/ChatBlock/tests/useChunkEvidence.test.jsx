import { renderHook, act } from '@testing-library/react-hooks';

import { useChunkEvidence } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useChunkEvidence';

const docs = [
  { document_id: 'doc-1', chunk_ind: 0 },
  { document_id: 'doc-2', chunk_ind: 1 },
];

const okFetch = (content) =>
  jest.fn(() =>
    Promise.resolve({ status: 200, json: () => Promise.resolve({ content }) }),
  );

describe('useChunkEvidence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not fetch while disabled', async () => {
    global.fetch = okFetch('text');
    const { result } = renderHook(() =>
      useChunkEvidence(docs, { enabled: false }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.evidence).toEqual({});
  });

  it('is unsettled until the evidence arrives, then settles', async () => {
    global.fetch = okFetch('chunk text');
    const { result, waitForNextUpdate } = renderHook(() =>
      useChunkEvidence(docs, { enabled: true, window: 0 }),
    );

    // The fact-check must not fire in the same commit that started the fetch.
    expect(result.current.evidenceSettled).toBe(false);

    await waitForNextUpdate();

    expect(result.current.evidenceSettled).toBe(true);
    expect(result.current.isFetchingEvidence).toBe(false);
    expect(result.current.evidence['doc-1'].text).toBe('chunk text');
    expect(result.current.evidence['doc-1'].kind).toBe('chunk');
  });

  it('fetches once per document set', async () => {
    global.fetch = okFetch('chunk text');
    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ items }) => useChunkEvidence(items, { enabled: true, window: 0 }),
      { initialProps: { items: docs } },
    );

    await waitForNextUpdate();
    const callsAfterFirst = global.fetch.mock.calls.length;

    rerender({ items: [...docs] }); // same ids, new array identity
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
    expect(result.current.evidenceSettled).toBe(true);
  });

  it('settles with blurbs when the fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() =>
      useChunkEvidence(docs, { enabled: true, window: 0 }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.evidenceSettled).toBe(true);
    // Transport failures degrade to snippet-marked entries rather than throwing.
    expect(result.current.evidence['doc-1']).toEqual({
      text: '',
      chunks: 0,
      kind: 'snippet',
    });
  });

  it('treats an empty document set as settled', () => {
    global.fetch = okFetch('text');
    const { result } = renderHook(() =>
      useChunkEvidence([], { enabled: true }),
    );
    expect(result.current.evidenceSettled).toBe(true);
    expect(result.current.isFetchingEvidence).toBe(false);
  });
});
