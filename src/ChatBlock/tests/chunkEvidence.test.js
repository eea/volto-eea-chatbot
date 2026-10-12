import {
  CHUNK_EVIDENCE_WINDOW,
  MAX_CHUNK_EVIDENCE_WINDOW,
  chunkInfoUrl,
  fetchChunk,
  fetchDocumentEvidence,
  fetchEvidence,
  normalizeWindow,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/chunkEvidence';

const response = (status, body = {}) => ({
  status,
  json: () => Promise.resolve(body),
});

const fetchReturning = (handler) =>
  jest.fn((url) => Promise.resolve(handler(url)));

const chunkIndOf = (url) =>
  Number(new URL(url, 'http://localhost').searchParams.get('chunk_id'));

describe('ChatBlock/services/chunkEvidence', () => {
  describe('normalizeWindow', () => {
    it('keeps sane whole numbers, including numeric strings from the CMS', () => {
      expect(normalizeWindow(0)).toBe(0);
      expect(normalizeWindow(2)).toBe(2);
      expect(normalizeWindow(5)).toBe(5);
      expect(normalizeWindow('3')).toBe(3);
    });

    it('clamps absurd windows instead of firing a request storm', () => {
      expect(normalizeWindow(999)).toBe(MAX_CHUNK_EVIDENCE_WINDOW);
      expect(normalizeWindow(-4)).toBe(0);
    });

    it('falls back to the default for junk input', () => {
      expect(normalizeWindow(undefined)).toBe(CHUNK_EVIDENCE_WINDOW);
      expect(normalizeWindow('abc')).toBe(CHUNK_EVIDENCE_WINDOW);
    });
  });

  describe('chunkInfoUrl', () => {
    it('routes through the _da proxy and encodes the document id', () => {
      const url = chunkInfoUrl('https://example.com/a b/c.pdf', 7);
      expect(url).toContain('/_da/document/chunk-info?document_id=');
      expect(url).toContain('https%3A%2F%2Fexample.com%2Fa%20b%2Fc.pdf');
      expect(url).toContain('chunk_id=7');
    });
  });

  describe('fetchChunk', () => {
    it('returns the chunk content on 200', async () => {
      const fetchImpl = fetchReturning(() =>
        response(200, { content: 'chunk text' }),
      );
      await expect(fetchChunk('doc-1', 0, { fetchImpl })).resolves.toBe(
        'chunk text',
      );
    });

    it('returns null on 404 (no such chunk)', async () => {
      const fetchImpl = fetchReturning(() => response(404));
      await expect(fetchChunk('doc-1', 99, { fetchImpl })).resolves.toBeNull();
    });

    it('retries once on 429 and returns the content', async () => {
      let calls = 0;
      const fetchImpl = jest.fn(() => {
        calls += 1;
        return Promise.resolve(
          calls === 1
            ? response(429)
            : response(200, { content: 'after retry' }),
        );
      });
      await expect(
        fetchChunk('doc-1', 0, { fetchImpl, retryDelay: 1 }),
      ).resolves.toBe('after retry');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('gives up after the single 429 retry', async () => {
      const fetchImpl = fetchReturning(() => response(429));
      await expect(
        fetchChunk('doc-1', 0, { fetchImpl, retryDelay: 1 }),
      ).resolves.toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('returns null on transport errors', async () => {
      const fetchImpl = jest.fn(() =>
        Promise.reject(new Error('network down')),
      );
      await expect(fetchChunk('doc-1', 0, { fetchImpl })).resolves.toBeNull();
    });

    // The Volto proxy pipes Onyx bodies without the upstream status, so errors
    // arrive as 200 + an error envelope. Verified live against the dev server:
    // 30 requests through /_da all returned 200, 24 of them "Chunk not found".
    it('treats a proxy-flattened 404 as a missing chunk', async () => {
      const fetchImpl = fetchReturning(() =>
        response(200, { detail: 'Chunk not found' }),
      );
      await expect(fetchChunk('doc-1', 9, { fetchImpl })).resolves.toBeNull();
    });

    it('treats an empty content field as a missing chunk', async () => {
      const fetchImpl = fetchReturning(() =>
        response(200, { content: '', num_tokens: 0 }),
      );
      await expect(fetchChunk('doc-1', 3, { fetchImpl })).resolves.toBeNull();
    });

    it('retries a proxy-flattened rate limit, not just a real 429', async () => {
      let calls = 0;
      const fetchImpl = fetchReturning(() => {
        calls += 1;
        return calls === 1
          ? response(200, {
              error: 'Rate limit exceeded. Please slow down your requests.',
            })
          : response(200, { content: 'recovered' });
      });
      await expect(
        fetchChunk('doc-1', 0, { fetchImpl, retryDelay: 0 }),
      ).resolves.toBe('recovered');
      expect(calls).toBe(2);
    });

    it('does not count flattened 404s as fetched chunks', async () => {
      const fetchImpl = fetchReturning((url) =>
        chunkIndOf(url) === 0
          ? response(200, { content: 'only chunk' })
          : response(200, { detail: 'Chunk not found' }),
      );
      const result = await fetchDocumentEvidence('doc-1', 0, {
        window: 2,
        fetchImpl,
      });
      expect(result.kind).toBe('chunk');
      expect(result.text).toBe('only chunk');
      expect(result.chunks).toBe(1);
    });
  });

  describe('fetchDocumentEvidence', () => {
    it('fetches the centre chunk plus the requested window', async () => {
      const fetchImpl = fetchReturning((url) =>
        response(200, { content: `chunk ${chunkIndOf(url)}` }),
      );
      const evidence = await fetchDocumentEvidence('doc-1', 3, {
        window: 2,
        fetchImpl,
      });
      expect(evidence.chunks).toBe(5);
      expect(evidence.kind).toBe('chunk');
      expect(evidence.text).toBe('chunk 1\nchunk 2\nchunk 3\nchunk 4\nchunk 5');
    });

    it('never asks for a negative chunk id', async () => {
      const fetchImpl = fetchReturning((url) =>
        response(200, { content: `chunk ${chunkIndOf(url)}` }),
      );
      await fetchDocumentEvidence('doc-1', 0, { window: 2, fetchImpl });
      const inds = fetchImpl.mock.calls.map(([url]) => chunkIndOf(url));
      expect(inds).toEqual([0, 1, 2]);
    });

    it('clamps a nonsensical window from a CMS field', async () => {
      const fetchImpl = fetchReturning((url) =>
        response(200, { content: `chunk ${chunkIndOf(url)}` }),
      );
      await fetchDocumentEvidence('doc-1', 100, { window: 500, fetchImpl });
      const inds = fetchImpl.mock.calls.map(([url]) => chunkIndOf(url));
      expect(inds.length).toBe(MAX_CHUNK_EVIDENCE_WINDOW * 2 + 1);
      expect(Math.max(...inds)).toBe(100 + MAX_CHUNK_EVIDENCE_WINDOW);
    });

    it('stops expanding at the first missing chunk above the centre', async () => {
      const fetchImpl = fetchReturning((url) => {
        const ind = chunkIndOf(url);
        return ind > 6 ? response(404) : response(200, { content: `c${ind}` });
      });
      const evidence = await fetchDocumentEvidence('doc-1', 5, {
        window: 5,
        fetchImpl,
      });
      const inds = fetchImpl.mock.calls.map(([url]) => chunkIndOf(url));
      expect(inds[inds.length - 1]).toBe(7);
      expect(evidence.kind).toBe('chunk');
    });

    it('degrades to kind=snippet when nothing could be resolved', async () => {
      const fetchImpl = fetchReturning(() => response(404));
      const evidence = await fetchDocumentEvidence('doc-1', 0, {
        window: 2,
        fetchImpl,
      });
      expect(evidence).toEqual({ text: '', chunks: 0, kind: 'snippet' });
    });
  });

  describe('fetchEvidence', () => {
    const docs = [
      { document_id: 'doc-1', chunk_ind: 0 },
      { document_id: 'doc-2', chunk_ind: 4 },
      { document_id: 'doc-1', chunk_ind: 0 }, // duplicate
      { chunk_ind: 3 }, // no document_id
      null,
    ];

    it('keys results by document_id and deduplicates documents', async () => {
      const fetchImpl = fetchReturning((url) =>
        response(200, {
          content: `text for ${new URL(url, 'http://localhost').searchParams.get('document_id')}`,
        }),
      );
      const evidence = await fetchEvidence(docs, { window: 0, fetchImpl });
      expect(Object.keys(evidence).sort()).toEqual(['doc-1', 'doc-2']);
      expect(evidence['doc-1'].text).toBe('text for doc-1');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('stays within the requested concurrency', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const fetchImpl = jest.fn(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight -= 1;
            resolve(response(200, { content: 'x' }));
          }, 5);
        });
      });
      const many = Array.from({ length: 10 }, (_, i) => ({
        document_id: `doc-${i}`,
        chunk_ind: 0,
      }));
      await fetchEvidence(many, { window: 0, concurrency: 3, fetchImpl });
      expect(maxInFlight).toBeLessThanOrEqual(3);
    });

    it('resolves an empty map for an empty document list', async () => {
      const fetchImpl = fetchReturning(() => response(200, { content: 'x' }));
      await expect(fetchEvidence([], { fetchImpl })).resolves.toEqual({});
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
