/**
 * Resolve the real document text behind a chat answer.
 *
 * The Onyx v3 stream ships documents as search *blurbs* (~600 chars) — it has no
 * `content` field at all (see `SearchDoc` in Onyx `context/search/models.py`).
 * Sending blurbs to the fact-checker makes supported claims look hallucinated,
 * because the answer was written from full chunk text, not from those snippets.
 *
 * Onyx already exposes that text:
 *
 *     GET /api/document/chunk-info?document_id=<id>&chunk_id=<n>
 *     -> { "content": "<chunk text>", "num_tokens": 512 }
 *
 * and the stream already carries both parameters for every document
 * (`document_id` + `chunk_ind`). This module goes through the Volto `/_da`
 * proxy so no extra credentials or CORS setup are needed.
 *
 * Notes:
 * - One chunk is ~512 tokens (`DOC_EMBEDDING_CONTEXT_SIZE`). Onyx builds the
 *   answer from the matched chunk *plus its neighbourhood* (±2 for
 *   `INCLUDE_ADJACENT_SECTIONS`, ±5 for `FULL_DOCUMENT`), so the centre chunk
 *   alone is not enough — `CHUNK_EVIDENCE_WINDOW` defaults to 2.
 * - A gateway in front of Onyx returns 429 under concurrency; one retry after a
 *   short delay clears it.
 * - 404 simply means "no such chunk" (past the end of the document) and ends the
 *   expansion for that document.
 */

export const CHUNK_EVIDENCE_WINDOW = 2;
/**
 * Safety bound for the window. Onyx itself never expands past ±5
 * (`FULL_DOC_NUM_CHUNKS_AROUND`), and every extra step costs two more chunk
 * requests per document, so a nonsensical CMS value is clamped rather than
 * turned into a request storm against a rate-limited gateway.
 */
export const MAX_CHUNK_EVIDENCE_WINDOW = 20;
const DEFAULT_CONCURRENCY = 4;
const RETRY_DELAY_MS = 1000;

export interface ChunkEvidence {
  /** Joined chunk text, empty string when nothing could be resolved. */
  text: string;
  /** How many chunks were fetched. */
  chunks: number;
  /**
   * `chunk`   – real Onyx chunk text, safe to verify against.
   * `snippet` – only the search blurb is available; absence of a claim in it is
   *             NOT evidence of hallucination.
   */
  kind: 'chunk' | 'snippet';
}

export type ChunkEvidenceMap = Record<string, ChunkEvidence>;

type FetchLike = (url: string) => Promise<{
  status: number;
  json: () => Promise<{ content?: string; num_tokens?: number }>;
}>;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Proxy path handled by `src/middleware.js` (`/_da/...` -> Onyx `/api/...`). */
export function chunkInfoUrl(documentId: string, chunkInd: number): string {
  return `/_da/document/chunk-info?document_id=${encodeURIComponent(
    documentId,
  )}&chunk_id=${chunkInd}`;
}

/**
 * Fetch a single chunk. Returns null for "no such chunk" (404) and for any
 * transport/HTTP failure, retrying once on 429.
 */
export async function fetchChunk(
  documentId: string,
  chunkInd: number,
  {
    fetchImpl,
    retryDelay = RETRY_DELAY_MS,
  }: { fetchImpl?: FetchLike; retryDelay?: number } = {},
): Promise<string | null> {
  const doFetch: FetchLike = fetchImpl || ((url: string) => fetch(url));

  const attempt = async (): Promise<{
    status: number;
    text: string;
  } | null> => {
    try {
      const response = await doFetch(chunkInfoUrl(documentId, chunkInd));
      if (response.status === 200) {
        const body = await response.json();
        return { status: 200, text: body?.content || '' };
      }
      return { status: response.status, text: '' };
    } catch {
      return null;
    }
  };

  let result = await attempt();
  if (result && result.status === 429) {
    await sleep(retryDelay);
    result = await attempt();
  }
  if (!result || result.status !== 200) {
    return null;
  }
  return result.text;
}

/**
 * Normalise a configured window: whole number between 0 and
 * `MAX_CHUNK_EVIDENCE_WINDOW`, falling back to the default for junk input.
 * The value comes from a Volto block field, so it can be anything an editor typed.
 */
export function normalizeWindow(window: number): number {
  const value = Number(window);
  if (!Number.isFinite(value)) {
    return CHUNK_EVIDENCE_WINDOW;
  }
  return Math.max(0, Math.min(Math.floor(value), MAX_CHUNK_EVIDENCE_WINDOW));
}

/**
 * Fetch the matched chunk plus `window` chunks on each side, stopping at the
 * first missing chunk above the centre (the end of the document).
 */
export async function fetchDocumentEvidence(
  documentId: string,
  centerChunkInd: number,
  {
    window = CHUNK_EVIDENCE_WINDOW,
    fetchImpl,
    retryDelay,
  }: { window?: number; fetchImpl?: FetchLike; retryDelay?: number } = {},
): Promise<ChunkEvidence> {
  const center = Math.max(0, Number(centerChunkInd) || 0);
  const win = normalizeWindow(window);
  const lower = Math.max(0, center - win);
  const upper = center + win;

  const inds: number[] = [];
  for (let ind = lower; ind <= upper; ind++) {
    inds.push(ind);
  }

  const texts: string[] = [];
  for (const ind of inds) {
    const content = await fetchChunk(documentId, ind, {
      fetchImpl,
      retryDelay,
    });
    if (content === null) {
      // Past the end of the document — everything above is missing too.
      if (ind > center) {
        break;
      }
      continue;
    }
    texts.push(content);
  }

  return {
    text: texts.join('\n'),
    chunks: texts.length,
    kind: texts.length > 0 ? 'chunk' : 'snippet',
  };
}

/**
 * Resolve evidence for a set of documents, a few at a time.
 *
 * Accepts anything carrying `document_id` + `chunk_ind` (the Onyx documents, or
 * the `halloumiSource`-shaped objects built for the fact-checker).
 */
export async function fetchEvidence(
  docs: any[],
  {
    window = CHUNK_EVIDENCE_WINDOW,
    concurrency = DEFAULT_CONCURRENCY,
    fetchImpl,
    retryDelay,
  }: {
    window?: number;
    concurrency?: number;
    fetchImpl?: FetchLike;
    retryDelay?: number;
  } = {},
): Promise<ChunkEvidenceMap> {
  const unique: any[] = [];
  const seen = new Set<string>();
  (docs || []).forEach((doc: any) => {
    const documentId = doc?.document_id;
    if (!documentId || seen.has(documentId)) {
      return;
    }
    seen.add(documentId);
    unique.push(doc);
  });

  const evidence: ChunkEvidenceMap = {};
  let cursor = 0;

  const worker = async () => {
    while (cursor < unique.length) {
      const current = cursor++;
      const doc = unique[current];
      evidence[doc.document_id] = await fetchDocumentEvidence(
        doc.document_id,
        doc.chunk_ind,
        { window, fetchImpl, retryDelay },
      );
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, unique.length)) },
    worker,
  );
  await Promise.all(workers);

  return evidence;
}
