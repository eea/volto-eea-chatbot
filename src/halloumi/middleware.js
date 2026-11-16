import fetch from 'node-fetch';
import debug from 'debug';
import { isPathAllowed } from '../middleware';

const log = debug('halloumi');

const MSG_INVALID_CONFIGURATION =
  'Invalid configuration: missing RAG_FACT_CHECKER_URL';

// Allowed paths for _ha (Halloumi) proxy.
// When adding new endpoints, update this list.
const ALLOWED_HALLOUMI_PATHS = [
  { path: '/generate', methods: ['POST'] },
  // Lets the UI say "fact-checking is unavailable" before the user spends a
  // click. Read-only, no body, and the upstream service is cluster-internal and
  // unauthenticated - so it is reachable only through this allowlist.
  { path: '/health', methods: ['GET'] },
];

const RAG_FACT_CHECKER_URL =
  process.env.RAG_FACT_CHECKER_URL || 'http://localhost:8000';

/**
 * Upstream budget for a fact-check, in the SSR process.
 *
 * The browser gives up at 240s (see ChatBlock/hooks/useQualityMarkers) and
 * Varnish cuts the connection at 300s. This sits between the two so that the
 * response reaching the browser is a JSON envelope we wrote, not a Varnish HTML
 * error page. Do not raise it past 300s without reading the timeout budget in
 * src/halloumi/README.md first.
 */
const UPSTREAM_TIMEOUT_MS = 270000;

/**
 * rag-facts-check runs one replica with no HPA, and each check is a chain of
 * LLM judge calls. Without a cap, a few chatty users queue everyone else behind
 * a multi-minute request - and each queued request also pins a Varnish worker.
 * Excess requests are rejected fast rather than queued, so the UI can say
 * "busy" instead of hanging.
 */
const MAX_CONCURRENT_CHECKS = 2;

let inFlight = 0;

function isTimeoutError(error) {
  return (
    error?.name === 'FetchError' &&
    (error?.type === 'request-timeout' || /timeout/i.test(error?.message || ''))
  );
}

/**
 * Health is a cheap GET and must not be gated by the fact-check concurrency
 * cap - a busy checker is still a live checker.
 */
async function proxyHealth(res) {
  try {
    const response = await fetch(`${RAG_FACT_CHECKER_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    const result = await response.json().catch(() => ({}));
    res.status(response.ok ? 200 : 503).send({
      ...result,
      status: response.ok ? 'ok' : 'unavailable',
    });
  } catch (error) {
    log('Halloumi health error', error);
    res.status(503).send({
      error: `Fact-checker unavailable: ${error.message || 'connection failed'}`,
      code: 'unreachable',
    });
  }
}

async function proxyGenerate(req, res) {
  const { sources, answer, batch_size } = req.body;

  log('Halloumi request body', {
    answer,
    sources: sources?.length,
  });

  try {
    const response = await fetch(`${RAG_FACT_CHECKER_URL}/halloumi/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer,
        sources,
        max_context_segments: 0,
        ...(batch_size != null && { batch_size }),
      }),
      timeout: UPSTREAM_TIMEOUT_MS,
    });

    const result = await response.json();

    if (response.ok) {
      log('Halloumi response', result);
      res.send(result);
      return;
    }

    log('Halloumi error response', result);
    const isBusy = response.status === 429 || response.status === 503;
    res.status(response.status).send({
      error: `Fact-checker error: ${
        result.detail || result.error || 'unknown error'
      }`,
      code: isBusy ? 'busy' : 'upstream_error',
      ...(isBusy && { retry_after: result.retry_after ?? 30 }),
    });
  } catch (error) {
    log('Halloumi fetch error', error);

    if (isTimeoutError(error)) {
      // Distinct from "unreachable": the service is up, this particular answer
      // simply could not be verified inside the budget. The UI says so, instead
      // of telling the user the service is down.
      res.status(504).send({
        error: 'Fact-checker timed out',
        code: 'timeout',
      });
      return;
    }

    res.status(502).send({
      error: `Fact-checker unavailable: ${error.message || 'connection failed'}`,
      code: 'unreachable',
    });
  }
}

export default async function middleware(req, res, next) {
  const path = req.url.replace('/_ha/', '/');

  // Reject paths not on the allowlist — prevents Confused Deputy attacks
  if (!isPathAllowed(path, req.method, ALLOWED_HALLOUMI_PATHS)) {
    res.statusCode = 404;
    res.statusMessage = 'Not Found';
    res.send({ error: 'Not Found' });
    return;
  }

  if (!RAG_FACT_CHECKER_URL) {
    res.send({
      error: MSG_INVALID_CONFIGURATION,
      code: 'misconfigured',
    });
    return;
  }

  res.set('Content-Type', 'application/json');

  if (path === '/health') {
    await proxyHealth(res);
    return;
  }

  if (inFlight >= MAX_CONCURRENT_CHECKS) {
    log('Halloumi concurrency cap reached', { inFlight });
    res.status(503).send({
      error: 'Fact-checker is busy, please retry shortly',
      code: 'busy',
      retry_after: 30,
    });
    return;
  }

  inFlight += 1;
  try {
    await proxyGenerate(req, res);
  } finally {
    inFlight -= 1;
  }
}
