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

/**
 * `AbortController` is everywhere in browsers, but the add-on is also tested
 * against Volto 17 (jest 26 / jsdom 16), where it is not guaranteed to exist.
 * A missing controller must degrade to "we cannot cancel", not to a crash.
 */
function createController() {
  if (typeof AbortController === 'undefined') {
    return { signal: undefined, abort() {} };
  }
  return new AbortController();
}

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
    ...(signal ? { signal } : {}),
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
    return { ...body, status: response.status };
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
function classifyFailure(envelope, timedOut = false) {
  if (timedOut) {
    return { outcome: QUALITY_CHECK_OUTCOME.timeout };
  }

  if (envelope?.nonJson) {
    return { outcome: QUALITY_CHECK_OUTCOME.timeout };
  }

  const status = envelope?.status;
  const code = envelope?.code;
  const isBusy = code === 'busy' || status === 429 || status === 503;

  if (isBusy) {
    return {
      outcome: QUALITY_CHECK_OUTCOME.busy,
      retryAfter: envelope?.retry_after ?? null,
    };
  }

  return { outcome: QUALITY_CHECK_OUTCOME.unreachable };
}

/**
 * Read an upstream response into either a checker body or a failure, without
 * touching React state - the caller decides whether the answer is still wanted.
 */
async function interpretResponse(response, timedOut) {
  if (!response.ok) {
    const envelope = await readErrorEnvelope(response);
    return { failure: classifyFailure(envelope, timedOut), envelope };
  }

  const body = await response.json();

  // The legacy proxy answers 200 with `{ error }` for its own misconfiguration;
  // treat that as unreachable rather than as a verdict.
  if (body?.error) {
    return {
      failure: { outcome: QUALITY_CHECK_OUTCOME.unreachable },
      envelope: body,
    };
  }

  return { body };
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

// The Onyx stream carries documents as search blurbs; prefer the structured
// source objects the block builds when they are available.
function toHalloumiSources(sources) {
  const hasStructuredSources =
    sources[0] && typeof sources[0].halloumiSource === 'object';

  return hasStructuredSources
    ? sources.map(({ halloumiSource }) => halloumiSource)
    : sources.map(({ halloumiContext }) => halloumiContext);
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
    if (!abortRef.current) {
      return;
    }
    try {
      abortRef.current.abort('superseded');
    } catch {
      // already settled
    }
    abortRef.current = null;
  }, []);

  React.useEffect(() => {
    const commitFailure = (failure) => {
      setError(failure);
      setPhase('error');
      setFailures((f) => f + 1);
    };

    async function handler() {
      if (sources.length === 0) {
        setError({ outcome: QUALITY_CHECK_OUTCOME.no_sources });
        setPhase('error');
        return;
      }

      const halloumiSources = toHalloumiSources(sources);
      const seq = ++requestSeq.current;
      const controller = createController();
      abortRef.current = controller;

      // Whether *this* request ran out of budget. Every other way an abort can
      // happen is a supersede or a cancel, and those are already handled by the
      // sequence-number check below.
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort('timeout');
        } catch {
          // already settled
        }
      }, timeoutMs);

      const started = Date.now();
      const context = () => ({
        latencyMs: Date.now() - started,
        sources: halloumiSources.length,
      });

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
        const result = await interpretResponse(response, timedOut);

        if (seq !== requestSeq.current) {
          return;
        }

        if (result.failure) {
          reportToSentry(
            result.envelope?.error ||
              `Fact-check failed: HTTP ${response.status}`,
            { ...context(), outcome: result.failure.outcome },
          );
          commitFailure(result.failure);
          return;
        }

        setMarkers(result.body);
        setError(null);
        setPhase('done');
      } catch (err) {
        if (seq !== requestSeq.current) {
          return;
        }

        const failure = classifyFailure({ status: 504 }, timedOut);
        reportToSentry(
          timedOut ? new Error('Fact-check timed out in the browser') : err,
          { ...context(), outcome: failure.outcome, timeoutMs },
        );
        commitFailure(failure);
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
    if (failures >= MAX_QUALITY_CHECK_ATTEMPTS) {
      return;
    }
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
