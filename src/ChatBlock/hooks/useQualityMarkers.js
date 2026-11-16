import React from 'react';
import loadable from '@loadable/component';

const Sentry = loadable.lib(
  () => import(/* webpackChunkName: "s_entry-browser" */ '@sentry/browser'), // chunk name avoids ad blockers
);

/**
 * Hard ceiling for a fact-check request, in the browser.
 *
 * The ordering below is not a style preference - it is what makes the failure
 * readable. A fact-check POST travels ingress-nginx -> edge nginx -> Varnish ->
 * Volto SSR -> rag-fact-checker, and the shortest timeout on that chain is
 * Varnish's `first_byte_timeout=300s`. Whoever times out first gets to decide
 * what the user sees, and a Varnish timeout is an HTML error page that this hook
 * cannot parse. So the browser gives up first, the SSR proxy second, and Varnish
 * should never be reached. See `src/halloumi/README.md` for the full budget.
 */
export const QUALITY_CHECK_TIMEOUT_MS = 240000;

/**
 * A failed check costs a real LLM run, so retries are bounded. The counter is
 * per message and resets on a successful check.
 */
export const MAX_QUALITY_CHECK_ATTEMPTS = 3;

/**
 * How the fact-check ended. `cancelled` is a user action and must never be
 * rendered as a failure; the other four are all distinct problems needing
 * distinct copy - collapsing them into one "service unreachable" message is
 * what made an outage and an over-long answer look identical.
 */
export const QUALITY_CHECK_OUTCOME = {
  no_sources: 'no_sources',
  unreachable: 'unreachable',
  busy: 'busy',
  timeout: 'timeout',
  cancelled: 'cancelled',
};

async function fetchHalloumi(
  answer,
  sources,
  maxContextSegments,
  batchSize,
  signal,
) {
  return fetch('/_ha/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      answer,
      sources,
      maxContextSegments,
      ...(batchSize != null && { batch_size: batchSize }),
    }),
    signal,
  });
}

// Best-effort: a proxy in the middle can answer with an HTML error page, and
// parsing that as JSON must not be what decides the outcome.
async function readErrorEnvelope(response) {
  const type = response.headers?.get?.('content-type') || '';
  if (!type.includes('json')) {
    return { nonJson: true, status: response.status };
  }
  try {
    const body = await response.json();
    return { ...(body || {}), status: response.status };
  } catch {
    return { nonJson: true, status: response.status };
  }
}

/**
 * Turn whatever went wrong into one of QUALITY_CHECK_OUTCOME.
 *
 * A non-JSON 503 is the signature of Varnish cutting the connection after
 * first_byte_timeout - the checker was working, the answer was simply too big to
 * verify in time. That is a timeout, not an outage, and telling the user the
 * service is down would be a lie.
 */
function classifyFailure(envelope, abortReason) {
  if (abortReason === 'timeout') {
    return { outcome: QUALITY_CHECK_OUTCOME.timeout };
  }

  const status = envelope?.status;
  const code = envelope?.code;

  if (envelope?.nonJson) {
    // A non-JSON 503 is Varnish cutting the connection at first_byte_timeout:
    // the checker was working, the answer was simply too big to verify in time.
    // Our own "busy" rejection is always JSON with an explicit code.
    return { outcome: QUALITY_CHECK_OUTCOME.timeout };
  }

  if (code === 'busy' || status === 429 || status === 503) {
    return {
      outcome: QUALITY_CHECK_OUTCOME.busy,
      retryAfter: envelope?.retry_after ?? null,
    };
  }

  return { outcome: QUALITY_CHECK_OUTCOME.unreachable };
}

function reportToSentry(error, context) {
  try {
    Sentry.load()
      .then((mod) => {
        mod.captureException(
          error instanceof Error ? error : new Error(String(error)),
          { extra: context },
        );
      })
      .catch(() => {
        // Sentry is optional; a reporting failure must not surface to the user.
      });
  } catch {
    // loadable not available (tests, SSR) - ignore.
  }
}

/**
 * Run the fact-check for one answer.
 *
 * Contract worth keeping in mind:
 * - `markers` is the raw checker body, or null. It is never a synthetic
 *   placeholder - failures are reported through `error` instead, so nothing can
 *   render a fake verdict.
 * - `status` is 'idle' | 'loading' | 'done' | 'error' | 'cancelled'. Callers use
 *   it together with the evidence-fetch state to show one continuous progress
 *   strip rather than a spinner that only appears for the last stage.
 * - Every in-flight request is aborted when it is superseded, when the component
 *   unmounts, or when the user cancels. A late response can never overwrite a
 *   newer one: each request carries a sequence number and only the current one
 *   is allowed to commit state.
 */
export function useQualityMarkers(
  doQualityControl,
  message,
  sources,
  maxContextSegments = 0,
  batchSize,
  timeoutMs = QUALITY_CHECK_TIMEOUT_MS,
) {
  const [markers, setMarkers] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('idle');
  // runId re-triggers the effect; failures counts failed attempts, which is what
  // the retry cap applies to. Keeping them apart means a user-initiated new
  // check is never blocked by an earlier run's failures.
  const [runId, setRunId] = React.useState(0);
  const [failures, setFailures] = React.useState(0);

  const abortRef = React.useRef(null);
  const requestSeq = React.useRef(0);
  // The effect must not restart just because the caller passed a fresh array
  // literal. `sources` is an object identity in the dependency list, so an
  // unstable caller would re-fire the whole check on every render - and with a
  // terminal state being set each time that is an infinite render loop. Only an
  // explicit transition back to 'idle' (a retry, or a user-requested start) may
  // launch a request.
  const statusRef = React.useRef('idle');
  const setPhase = React.useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const abortInFlight = React.useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort('superseded');
      } catch {
        // already settled
      }
      abortRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    async function handler() {
      // Prefer structured sources (with title metadata) over plain text.
      // Fall back to halloumiContext strings for backward compatibility.
      const firstSource = sources[0];
      const hasStructuredSources =
        firstSource && typeof firstSource.halloumiSource === 'object';

      const halloumiSources = hasStructuredSources
        ? sources.map(({ halloumiSource }) => halloumiSource)
        : sources.map(({ halloumiContext }) => halloumiContext);

      if (sources.length === 0) {
        setError({ outcome: QUALITY_CHECK_OUTCOME.no_sources });
        setPhase('error');
        return;
      }

      const seq = ++requestSeq.current;
      const controller = new AbortController();
      abortRef.current = controller;

      // Why this request ended up in the catch block. Only the timer sets it:
      // every other abort is a supersede or a cancel, and those are already
      // handled by the sequence-number check below.
      let abortReason = null;

      const timer = setTimeout(() => {
        abortReason = 'timeout';
        try {
          controller.abort('timeout');
        } catch {
          // already settled
        }
      }, timeoutMs);

      const started = Date.now();
      setPhase('loading');
      setError(null);

      try {
        const response = await fetchHalloumi(
          message,
          halloumiSources,
          maxContextSegments,
          batchSize,
          controller.signal,
        );

        if (!response.ok) {
          const envelope = await readErrorEnvelope(response);
          const failure = classifyFailure(envelope, abortReason);
          if (seq !== requestSeq.current) return;
          reportToSentry(
            envelope?.error || `Fact-check failed: HTTP ${response.status}`,
            {
              outcome: failure.outcome,
              status: response.status,
              latencyMs: Date.now() - started,
              sources: halloumiSources.length,
            },
          );
          setError(failure);
          setPhase('error');
          setFailures((f) => f + 1);
          return;
        }

        const body = await response.json();

        // The legacy proxy answers 200 with `{ error }` for its own
        // misconfiguration; treat that as unreachable rather than as a verdict.
        if (body?.error) {
          if (seq !== requestSeq.current) return;
          reportToSentry(body.error, {
            outcome: QUALITY_CHECK_OUTCOME.unreachable,
            latencyMs: Date.now() - started,
            sources: halloumiSources.length,
          });
          setError({ outcome: QUALITY_CHECK_OUTCOME.unreachable });
          setPhase('error');
          setFailures((f) => f + 1);
          return;
        }

        if (seq !== requestSeq.current) return;
        setMarkers(body);
        setError(null);
        setPhase('done');
      } catch (err) {
        if (seq !== requestSeq.current) return;

        if (abortReason === 'superseded') {
          // A newer request owns the UI now; say nothing.
          return;
        }

        const failure = classifyFailure(
          abortReason === 'timeout' ? { status: 504 } : {},
          abortReason,
        );

        if (failure.outcome === QUALITY_CHECK_OUTCOME.timeout) {
          reportToSentry(new Error('Fact-check timed out in the browser'), {
            latencyMs: Date.now() - started,
            timeoutMs,
            sources: halloumiSources.length,
          });
        } else {
          reportToSentry(err, {
            outcome: failure.outcome,
            latencyMs: Date.now() - started,
            sources: halloumiSources.length,
          });
        }

        setError(failure);
        setPhase('error');
        setFailures((f) => f + 1);
      } finally {
        clearTimeout(timer);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    }

    if (doQualityControl && !markers && statusRef.current === 'idle') {
      handler();
    }

    return () => {
      // The effect only re-runs when its inputs change, or on unmount, so an
      // in-flight request at this point is genuinely superseded.
      abortInFlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doQualityControl,
    runId,
    message,
    sources,
    maxContextSegments,
    batchSize,
    timeoutMs,
  ]);

  /** Re-run after a failure. Bounded, because each attempt is a real LLM run. */
  const retryHalloumi = React.useCallback(() => {
    if (failures >= MAX_QUALITY_CHECK_ATTEMPTS) return;
    abortInFlight();
    setMarkers(null);
    setError(null);
    setPhase('idle');
    setRunId((r) => r + 1);
  }, [abortInFlight, failures, setPhase]);

  /** Start a check the user asked for. Not bounded by earlier failures. */
  const startHalloumi = React.useCallback(() => {
    abortInFlight();
    setMarkers(null);
    setError(null);
    setPhase('idle');
    setRunId((r) => r + 1);
  }, [abortInFlight, setPhase]);

  /**
   * Stop waiting. This is a user decision, not a failure: the answer stays
   * exactly as it was and the Fact-check button becomes available again.
   */
  const cancelHalloumi = React.useCallback(() => {
    abortInFlight();
    requestSeq.current += 1;
    setError(null);
    setPhase('cancelled');
  }, [abortInFlight, setPhase]);

  const claims = markers?.claims || [];
  if (markers && Array.isArray(claims)) {
    markers.claims = claims.filter((claim) => {
      const claim_text = message.substring(claim.startOffset, claim.endOffset);
      const hasSpace = claim_text.trim().includes(' ');
      const hasSpecialCharacters = /[^a-zA-Z0-9 ]/.test(claim_text);
      const hasSmallScore = claim.score < 0.07;

      return hasSpace || !hasSpecialCharacters || !hasSmallScore;
    });
  }

  return {
    markers,
    error,
    status,
    failures,
    canRetry: failures < MAX_QUALITY_CHECK_ATTEMPTS,
    isLoadingHalloumi: status === 'loading',
    retryHalloumi,
    startHalloumi,
    cancelHalloumi,
  };
}
