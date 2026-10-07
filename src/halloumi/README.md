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

## Configuration

| Environment Variable   | Default                 | Description                              |
| ---------------------- | ----------------------- | ---------------------------------------- |
| `RAG_FACT_CHECKER_URL` | `http://localhost:8000` | Base URL of the rag-fact-checker service |

## Original Halloumi

The original implementation was based on Apache2 licensed https://github.com/oumi-ai/halloumi-demo/tree/d088e1f25e7785326a53bc120113e226ee2f54b7

It used a custom LLM model (HallOumi-8B) accessed via an LLM gateway, with complex prompt preprocessing, chunking, logprob-based postprocessing, and claim filtering. This has been replaced by the rag-fact-checker service which uses a claim extraction + per-claim verification pipeline.
