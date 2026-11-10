# Halloumi Fact-Checking Middleware

This middleware proxies fact-checking requests to the **rag-fact-checker** service (https://github.com/eea/rag-fact-check), which replaces the original Halloumi LLM-based integration.

## Architecture

```
Frontend (useQualityMarkers.js)
  → POST /_ha/generate
    → Express middleware (middleware.js)
      → POST {RAG_FACT_CHECKER_URL}/halloumi/generate
        → rag-fact-checker FastAPI service
```

The rag-fact-checker's `/halloumi/generate` endpoint is a drop-in replacement for the original Halloumi API — it accepts the same request format (`{answer, sources}`) and returns a compatible response (`{claims, segments}`), so all existing frontend components (`HalloumiFeedback`, `useQualityMarkers`, `ClaimSegments`) work without changes.

## Multi-evidence claims

A claim can be supported by several evidence quotes (the fact-checker returns up to
3 per claim), so `claim.segmentIds` is a list and each segment carries offsets into
the **joined** sources string:

```json
{
  "claims": [{ "segmentIds": ["0", "1", "2"], "score": 1.0 }],
  "segments": {
    "0": { "id": 0, "startOffset": 120, "endOffset": 190 },
    "1": { "id": 1, "startOffset": 402, "endOffset": 455 },
    "2": { "id": 2, "startOffset": 980, "endOffset": 1030 }
  }
}
```

`ClaimSegments` groups those segments per source (one tab per cited document, one
"Jump to citation" chip per segment) and `RenderClaimView` highlights them inside the
source text. Segments are half-open `[start, end)`; overlapping ones are clipped so
the source text is never rendered twice.

## Source text: Onyx chunks, not search blurbs

The Onyx v3 chat stream carries documents as `SearchDoc` objects, which have **no
`content` field** — only a ~600-character `blurb`. Sending blurbs makes supported
claims look hallucinated, because the answer was written from full chunk text.

`ChatBlock/services/chunkEvidence.ts` therefore resolves the real text before the
fact-check runs, through the existing `/_da` proxy:

```
GET /_da/document/chunk-info?document_id=<id>&chunk_id=<n>
  -> Onyx GET /api/document/chunk-info -> { "content": "<chunk text>", "num_tokens": 512 }
```

- Both parameters are already present on every streamed document (`document_id`,
  `chunk_ind`), so no extra data is needed from Onyx.
- The matched chunk is fetched together with `chunkEvidenceWindow` chunks on each
  side (default **2**, i.e. what Onyx's `INCLUDE_ADJACENT_SECTIONS` expansion uses).
  The centre chunk alone is not enough — the claims usually sit in its
  neighbourhood. Onyx's widest expansion is ±5; raise the value to match it.
- The window is also a block setting — **Evidence window** in the chat block sidebar —
  so it can be tuned per block without a deploy. Values outside 0–20 are clamped
  (`MAX_CHUNK_EVIDENCE_WINDOW`): each extra step costs two more chunk requests per
  document against a rate-limited gateway.
- A gateway in front of Onyx returns **429** under concurrency, so requests run
  through a small pool with one retry after 1s. **404** means "no such chunk" and
  simply ends the expansion for that document.
- `useChunkEvidence` gates the fact-check call on `evidenceSettled`, so a check is
  never fired on blurbs in the same commit that started the fetch. If resolution
  fails, verification still runs on blurbs rather than never running.

Each source sent to the fact-checker carries `kind`:

| `kind`    | meaning                                                               |
| --------- | --------------------------------------------------------------------- |
| `chunk`   | real Onyx chunk text — a claim missing from it is meaningful evidence |
| `snippet` | only the search blurb is available — a missing claim proves nothing   |

The fact-checker answers with a `context_quality` block describing what it was
actually given:

```json
{
  "level": "partial",
  "sources": 4,
  "chunk_sources": 3,
  "snippet_sources": 1,
  "note": "1 of 4 sources were search snippets, not full document text…"
}
```

| `level`   | meaning                                                     |
| --------- | ----------------------------------------------------------- |
| `full`    | every source was `chunk` text — the score is a real verdict |
| `partial` | at least one source was a `snippet`                         |
| `unknown` | the backend reported no level (older deployment)            |
| `none`    | no sources reached the checker                              |

In `partial` mode each `not_enough_info` claim additionally carries
`context_limited: true`. Both signals are rendered: `HalloumiFeedback` shows a
"Partial context" notice under the score, and `ClaimModal` labels such a claim
`Unverified / Partial context` instead of `Low / Verification`. The numeric score is
deliberately left alone — the label carries the caveat, the number stays comparable
across runs.

`halloumiContext` (used for segment highlighting) and `halloumiSource.text` (used by
the fact-checker for offsets) are always the same nbsp-cleaned string. Changing one
without the other breaks highlighting.

## Configuration

| Environment Variable   | Default                 | Description                              |
| ---------------------- | ----------------------- | ---------------------------------------- |
| `RAG_FACT_CHECKER_URL` | `http://localhost:8000` | Base URL of the rag-fact-checker service |

## Original Halloumi

The original implementation was based on Apache2 licensed https://github.com/oumi-ai/halloumi-demo/tree/d088e1f25e7785326a53bc120113e226ee2f54b7

It used a custom LLM model (HallOumi-8B) accessed via an LLM gateway, with complex prompt preprocessing, chunking, logprob-based postprocessing, and claim filtering. This has been replaced by the rag-fact-checker service which uses a claim extraction + per-claim verification pipeline.
