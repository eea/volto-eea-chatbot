import debug from 'debug';
import fetch from 'node-fetch';

const log = debug('halloumi');

const LLMGW_URL = process.env.LLMGW_URL;
const LLMGW_API_KEY = process.env.LLMGW_TOKEN;
const MIN_CONTEXT_SENTENCES_FOR_FILTERING = 75;

const filterModel = {
  name: 'Inhouse-LLM/gpt-oss-120b',
  apiUrl: `${LLMGW_URL}/chat/completions`,
  apiKey: LLMGW_API_KEY,
};

export async function callLLM(apiUrl, apiKey, requestBody, { ip } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    accept: 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (ip) {
    headers['X-Forwarded-For'] = ip;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  return response.json();
}

function buildClaimFilterPrompt(sentences) {
  const numberedSentences = sentences
    .map((s, i) => `${i + 1}. "${s.trim()}"`)
    .join('\n');

  return `Given the following numbered sentences, identify which ones are NOT verifiable factual claims.

Exclude sentences that are:
- Greetings, preambles, or transitional phrases
- Opinions, vague statements, or subjective assessments
- Introductory sentences that set up a list or table
- Sentences that merely restate or paraphrase the question
- Conversational closers (e.g., "let me know if you need more")
- Broad summaries that don't assert a specific fact
- Disclaimers or meta-commentary about the response itself
- Sentences that do not provide enough information to verify
- Sentences that only mention a concept without providing specific information

Respond with ONLY a comma-separated list of the sentence numbers to exclude. If none should be excluded, respond with "NONE".

Sentences:
${numberedSentences}`;
}

function buildContextFilterPrompt(contextSentences, claimSentences) {
  const numberedContext = contextSentences
    .map((s, i) => `${i + 1}. "${s.trim()}"`)
    .join('\n');
  const numberedClaims = claimSentences
    .map((s, i) => `${i + 1}. "${s.trim()}"`)
    .join('\n');

  return `Given the following context sentences and claims, identify which context sentences are NOT relevant to verifying ANY of the claims.

Context sentences:
${numberedContext}

Claims to verify:
${numberedClaims}

Respond with ONLY a comma-separated list of the context sentence numbers that are NOT relevant. If all are relevant, respond with "NONE".`;
}

/**
 * Parses a comma-separated list of indices from an LLM response.
 */
export function parseExcludeIndices(content, maxIndex) {
  const excludeIndices = new Set();
  if (content.trim().toUpperCase() === 'NONE') {
    return excludeIndices;
  }
  const matches = content.match(/\d+/g) || [];
  for (const match of matches) {
    const idx = parseInt(match, 10);
    if (idx >= 1 && idx <= maxIndex) {
      excludeIndices.add(idx);
    }
  }
  return excludeIndices;
}

async function callFilterModel(prompt, { ip } = {}) {
  const data = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
    model: filterModel.name,
  };
  const jsonData = await callLLM(filterModel.apiUrl, filterModel.apiKey, data, {
    ip,
  });
  return jsonData.choices?.[0]?.message?.content || '';
}

export async function excludeClaimSentences(sentences, { ip } = {}) {
  if (sentences.length === 0) {
    return new Set();
  }

  try {
    const prompt = buildClaimFilterPrompt(sentences);
    const content = await callFilterModel(prompt, { ip });
    const excludedIndices = parseExcludeIndices(content, sentences.length);
    log('Claim filter response', excludedIndices.size);
    return excludedIndices;
  } catch (error) {
    log('Claim filter failed, skipping', error);
    return new Set();
  }
}

export async function excludeContextSentences(
  contextSentences,
  claimSentences,
  { ip } = {},
) {
  if (contextSentences.length <= MIN_CONTEXT_SENTENCES_FOR_FILTERING) {
    return new Set();
  }

  try {
    const prompt = buildContextFilterPrompt(contextSentences, claimSentences);
    const content = await callFilterModel(prompt, { ip });
    const excludedIndices = parseExcludeIndices(
      content,
      contextSentences.length,
    );
    log('Context filter response', excludedIndices.size);
    return excludedIndices;
  } catch (error) {
    log('Context filter failed, skipping', error);
    return new Set();
  }
}
