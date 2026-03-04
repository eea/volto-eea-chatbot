import debug from 'debug';
import fs from 'fs';
import {
  getClaimsFromResponse,
  getTokenProbabilitiesFromLogits,
} from './postprocessing';
import { createChunkedHalloumiPrompts, getOffsets } from './preprocessing';
import { splitMarkdown, splitProse } from './markdown-splitter';
import { callLLM, excludeClaimSentences } from './filtering';

const log = debug('halloumi');

const tokenChoices = new Set(['supported', 'unsupported']);

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function applyPlattScaling(platt, probability) {
  probability = Math.min(Math.max(probability, 1e-6), 1 - 1e-6);
  const log_prob = Math.log(probability / (1 - probability));
  return sigmoid(-1 * (platt.a * log_prob + platt.b));
}

/**
 * Merges claims from multiple chunked HallOumi responses.
 * For each response sentence (claimId), combines segment citations
 * and takes the max supported score.
 */
function mergeChunkClaims(chunkResults) {
  const claimMap = new Map();

  for (const claims of chunkResults) {
    for (const claim of claims) {
      if (!claimMap.has(claim.claimId)) {
        claimMap.set(claim.claimId, { ...claim });
      } else {
        const existing = claimMap.get(claim.claimId);
        existing.segments.push(...claim.segments);
        // Keep the result with the higher supported score
        const existingScore = existing.probabilities.get('supported') || 0;
        const newScore = claim.probabilities.get('supported') || 0;
        if (newScore > existingScore) {
          existing.probabilities = claim.probabilities;
          existing.explanation = claim.explanation;
          existing.supported = claim.supported;
        }
      }
    }
  }

  return Array.from(claimMap.values());
}

export async function getVerifyClaimResponse(model, sources, answer, { ip } = {}) {
  const emptyResponse = {
    claims: [],
    segments: {},
  };
  if (!sources?.length || !answer) {
    return { ...emptyResponse, reason: 'Context is empty' };
  }

  // Split sentences
  const responseSentences = splitMarkdown(answer);
  const responseOffsets = getOffsets(answer, responseSentences);

  // Filter claims and context in parallel
  const [excludeResponseIndices] = await Promise.all([
    excludeClaimSentences(responseSentences, { ip }),
  ]);

  const contextSentences = [];
  const indexedContextSentences = sources.reduce((acc, text, sourceIdx) => {
    const sentences = splitProse(text, 50).map((sentence, sentenceIdx) => {
      const globalId = acc.length + sentenceIdx + 1;
      contextSentences.push(sentence);
      return {
        sentence,
        sourceId: sourceIdx + 1,
        globalId,
      };
    });
    acc.push(...sentences);
    return acc;
  }, []);
  const joinedContext = sources.join('');
  const contextOffsets = getOffsets(joinedContext, contextSentences);

  if (excludeResponseIndices.size === responseSentences.length) {
    log('All response sentences excluded');
    return {
      ...emptyResponse,
      empty: 'Claims in the document could not be verified',
    };
  }
  log('Excluded response indices', excludeResponseIndices);
  const { prompts } = createChunkedHalloumiPrompts({
    indexedContextSentences,
    responseSentences,
    responseOffsets,
    request: null,
    excludeResponseIndices,
  });

  log(`Split into ${prompts.length} chunk(s)`);

  // Run all chunks in parallel
  const chunkResults = await Promise.all(
    prompts.map((chunkPrompt, i) => {
      log(`Chunk ${i + 1} request`);
      return halloumiGenerativeAPI(model, chunkPrompt, { ip });
    }),
  );

  // Merge raw claims across chunks
  const rawClaims = mergeChunkClaims(chunkResults);

  const mergedPrompt = {
    contextOffsets,
    responseOffsets,
    joinedContext,
  };
  const converted = convertGenerativesClaimToVerifyClaimResponse(
    rawClaims,
    mergedPrompt,
  );

  if (excludeResponseIndices.size > 0) {
    for (const idx of excludeResponseIndices) {
      if (responseOffsets.has(idx)) {
        const offsets = responseOffsets.get(idx);
        converted.claims.push({
          claimId: idx,
          claimString: responseSentences[idx - 1],
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
          skipped: true,
          score: null,
        });
      }
    }
    converted.claims.sort((a, b) => a.startOffset - b.startOffset);
  }

  const result = {
    ...converted,
    rawClaims,
    ...(prompts.length === 1
      ? { halloumiPrompt: prompts[0] }
      : { halloumiPrompts: prompts }),
  };

  return result;
}

/**
 * Fetches a response from the LLM.
 *
 * @param {object} model The model configuration.
 * @param {object} prompt The prompt to send to the LLM.
 * @returns {Promise<object>} The JSON response from the LLM.
 *
 * Environment Variables:
 * - `MOCK_HALLOUMI_FILE_PATH`: If set, the function reads the LLM response from the specified file path instead of making an API call.
 * - `DUMP_HALLOUMI_REQ_FILE_PATH`: If set, the LLM request (URL and parameters) is dumped to the specified file path.
 * - `DUMP_HALLOUMI_FILE_PATH`: If set, the LLM response is dumped to the specified file path.
 */
async function getLLMResponse(model, prompt, { ip } = {}) {
  let jsonData;

  if (process.env.MOCK_HALLOUMI_FILE_PATH) {
    const filePath = process.env.MOCK_HALLOUMI_FILE_PATH;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    jsonData = JSON.parse(fileContent);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return jsonData;
  }

  const data = {
    messages: [{ role: 'user', content: prompt.prompt }],
    temperature: 0.0,
    model: model.name,
    logprobs: true,
    top_logprobs: 3,
  };

  if (process.env.DUMP_HALLOUMI_REQ_FILE_PATH) {
    const filePath = process.env.DUMP_HALLOUMI_REQ_FILE_PATH;
    fs.writeFileSync(
      filePath,
      JSON.stringify({ url: model.apiUrl, body: data }, null, 2),
    );
    log(`Dumped halloumi request: ${filePath}`);
  }

  jsonData = await callLLM(model.apiUrl, model.apiKey, data, { ip });

  if (process.env.DUMP_HALLOUMI_FILE_PATH) {
    const filePath = process.env.DUMP_HALLOUMI_FILE_PATH;
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    log(`Dumped halloumi response: ${filePath}`);
  }

  return jsonData;
}

/**
 * Gets all claims from a response.
 * @param response A string containing all claims and their information.
 * @returns A list of claim objects.
 */
export async function halloumiGenerativeAPI(model, prompt, { ip } = {}) {
  const jsonData = await getLLMResponse(model, prompt, { ip });

  // Todo: restore log
  // log('Generative response', jsonData);

  const finishReason = jsonData.choices?.[0]?.finish_reason;
  if (finishReason === 'length') {
    throw new Error('HallOumi response truncated (finish_reason: length)');
  }

  // Todo: restore log
  // log('Logprobs', jsonData.choices[0].logprobs.content);

  const logits = jsonData.choices[0].logprobs.content;
  const tokenProbabilities = getTokenProbabilitiesFromLogits(
    logits,
    tokenChoices,
  );
  const parsedResponse = getClaimsFromResponse(
    jsonData.choices[0].message.content,
  );

  if (parsedResponse.length !== tokenProbabilities.length) {
    log(
      'Warning: token probabilities (%d) and claims (%d) do not match — using available probabilities, defaulting remainder to 0.5',
      tokenProbabilities.length,
      parsedResponse.length,
    );
  }

  const defaultScoreMap = new Map([
    ['supported', 0.5],
    ['unsupported', 0.5],
  ]);

  for (let i = 0; i < parsedResponse.length; i++) {
    const scoreMap = tokenProbabilities[i] ?? new Map(defaultScoreMap);
    if (model.plattScaling) {
      const platt = model.plattScaling;
      const unsupportedScore = applyPlattScaling(
        platt,
        scoreMap.get('unsupported'),
      );
      const supportedScore = 1 - unsupportedScore;
      scoreMap.set('supported', supportedScore);
      scoreMap.set('unsupported', unsupportedScore);
    }
    parsedResponse[i].probabilities = scoreMap;
  }

  return parsedResponse;
}

export function convertGenerativesClaimToVerifyClaimResponse(
  generativeClaims,
  prompt,
) {
  const segments = {};
  const claims = [];

  for (const offset of prompt.contextOffsets) {
    const id = offset[0].toString();
    segments[id] = {
      id,
      startOffset: offset[1].startOffset,
      endOffset: offset[1].endOffset,
      text: prompt.joinedContext.slice(
        offset[1].startOffset,
        offset[1].endOffset,
      ),
    };
  }

  for (const generativeClaim of generativeClaims) {
    const segmentIds = [];
    for (const seg of generativeClaim.segments) {
      if (!seg) continue;
      segmentIds.push(seg.toString());
    }

    const claimId = generativeClaim.claimId;
    if (!prompt.responseOffsets.has(claimId)) {
      throw new Error(`Claim ${claimId} not found in response offsets.`);
    }

    const claimResponseWindow = prompt.responseOffsets.get(claimId);
    const score = generativeClaim.probabilities.get('supported');
    const claim = {
      claimId,
      claimString: generativeClaim.claimString,
      startOffset: claimResponseWindow.startOffset,
      endOffset: claimResponseWindow.endOffset,
      rationale: generativeClaim.explanation,
      segmentIds,
      score,
    };
    claims.push(claim);
  }

  const response = {
    claims,
    segments,
  };

  return response;
}
