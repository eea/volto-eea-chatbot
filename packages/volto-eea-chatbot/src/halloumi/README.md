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

## Timeout budget — and the discrepancies in it

A fact-check request travels a long proxy chain before it reaches this service.
The limits below were read out of `helm-charts/sources/cca-frontend` (chart
`cca-frontend`) and `eeacms/plone-varnish`, on 2026-11-13. They are **not**
configured together anywhere, which is the problem: each hop was set on its own,
and nobody owns the chain. Verify them again before relying on any number here.

| hop                                       | limit                                              | where it is set                                                    |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| browser → ingress-nginx                   | read **480s**, send 120s                           | `values.yaml` → `ingress.annotations`                              |
| ingress-nginx → edge nginx                | —                                                  | `templates/ingress.yaml`                                           |
| edge nginx → `varnish_frontend`           | connect 60s, read/send 600s                        | `templates/nginx-configmap.yaml`                                   |
| **varnish → Volto SSR**                   | connect 2s, **first_byte 300s**, between_bytes 60s | `eeacms/plone-varnish` `Dockerfile` (`-p first_byte_timeout=300s`) |
| Volto SSR → rag-fact-checker (this proxy) | **none**                                           | `middleware.js` — `node-fetch` without `timeout`                   |
| rag-fact-checker → LLM gateway            | **120s per judge call**                            | `values.yaml` → `ragFactsCheck.environment.LLM_TIMEOUT`            |

The four discrepancies that matter:

1. **The binding limit is Varnish's `first_byte_timeout=300s`, and it is the only
   hop nobody chose.** `/_ha/generate` is a long, non-cacheable POST, but it
   rides `location /` → `varnish_frontend` — the same route as page HTML.
   Varnish cannot cache anything on it, so in this path it contributes only a
   300s ceiling, pressure on `thread_pools=8 / thread_pool_timeout=120`, and
   HTML error pages. The ingress above it allows 480s, which is unreachable in
   practice. (Bypassing Varnish for `/_ha` would fix the class of problem, but
   **nginx is deliberately left alone** — so the 300s ceiling is a fixed
   constraint the add-on has to design around, not a knob to turn.)
2. **`LLM_TIMEOUT=120` is per judge call, not per request.** The chart comment
   next to it says "keep the whole request well under" Varnish's 300s, but the
   value does not enforce that. rag-fact-check does claim extraction plus one
   judge call **per claim**, so N claims can legitimately need up to N × 120s.
   A typical answer finishes in well under a minute; a 3+ claim answer behind a
   slow gateway can exceed 300s on its own. "A minute per generate" is a
   per-call expectation, not a per-request one.
3. **This proxy has no timeout at all.** A hung upstream pins an Express request
   (and a browser connection, and a Varnish worker) until Varnish gives up at
   300s. `volto.replicaCount: 1` with `autoscaling.enabled: false` (2Gi) and
   `ragFactsCheck.replicaCount: 1` (1Gi, no HPA) mean a handful of concurrent
   slow checks degrades the whole site, not just the chat.
4. **When Varnish wins, the client gets HTML, not JSON.** A check past 300s is
   cut off by Varnish with a 503 HTML page. `useQualityMarkers` calls
   `response.json()` without checking `ok` or `content-type`, so it throws, and
   the user is told "Halloumi service is unreachable or timed out" — which is
   wrong: the service was working, the answer just had too much in it to check in
   time. This is the most likely slow-service failure in production.

The ordering the add-on must therefore keep:

```
client abort          240s   → the user sees our message
this proxy's timeout  270s   → the SSR returns a JSON 504 envelope
Varnish first_byte    300s   → fixed ceiling, nginx is not being changed
ingress read          480s   → unreachable in practice
```

Each layer must give up before the one above it, otherwise the browser receives
someone else's HTML error page instead of a message we wrote.

Two more things worth knowing from the same chart:

- `ragFactsCheck.enabled: true` wires `/health` into liveness, readiness and
  startup probes on `rag-facts-check:8000`. The service is **cluster-internal and
  unauthenticated**, so a UI health probe must go through this proxy's allowlist,
  never straight from the browser.
- An empty `RAG_FACT_CHECKER_URL` with the service disabled falls back to
  `http://localhost:8000`, so every check fails with "Fact-checker unavailable".
  In the UI today that is indistinguishable from a transient outage.

## Failure envelope

Every non-success from this proxy is JSON with a `code`, so the browser can say
something specific instead of one generic message:

| HTTP | `code`        | when                                                                                           |
| ---- | ------------- | ---------------------------------------------------------------------------------------------- |
| 502  | `unreachable` | connection to the checker failed                                                               |
| 503  | `busy`        | the proxy's own concurrency cap was hit, or the checker rate-limited us; carries `retry_after` |
| 504  | `timeout`     | the checker did not answer inside `UPSTREAM_TIMEOUT_MS`                                        |
| 200  | `error`       | legacy shape, kept: a 200 carrying `{ error }` is treated as unreachable by the client         |

The client (`ChatBlock/hooks/useQualityMarkers`) maps these to
`QUALITY_CHECK_OUTCOME` — `unreachable`, `busy`, `timeout`, `no_sources` — and
renders different copy for each. Two rules worth preserving:

- **A non-JSON 503 is a timeout, not an outage.** That is Varnish cutting the
  connection, meaning the checker was working and the answer was simply too big
  to verify in one pass. Telling the user the service is down would be wrong.
- **`cancelled` is not a failure.** The user pressing Cancel returns the answer
  to its unverified state with the button re-enabled; it must never render an
  error message.

The proxy also caps concurrent checks (`MAX_CONCURRENT_CHECKS`) rather than
queueing them: one replica, no HPA, and each check is a chain of LLM judge
calls, so queueing turns one chatty user into a multi-minute wait for everyone.
`/health` is deliberately exempt from the cap — a busy checker is still a live
checker.

**The cap only holds if a cancel reaches upstream.** The browser aborting its
fetch says nothing to the checker, which by then is several LLM calls deep, and
the abandoned request keeps holding one of the two slots until it finishes. Two
cancels are then enough to wedge the service: every later check is rejected as
`busy`, and the client-side retry cap turns that into a message with no working
affordance at all. So `proxyGenerate` wires `req.on('close')` to an
`AbortController` on the upstream fetch, and a request the client walked away
from is logged as abandoned rather than answered or reported as an outage.

## Original Halloumi

The original implementation was based on Apache2 licensed https://github.com/oumi-ai/halloumi-demo/tree/d088e1f25e7785326a53bc120113e226ee2f54b7

It used a custom LLM model (HallOumi-8B) accessed via an LLM gateway, with complex prompt preprocessing, chunking, logprob-based postprocessing, and claim filtering. This has been replaced by the rag-fact-checker service which uses a claim extraction + per-claim verification pipeline.
