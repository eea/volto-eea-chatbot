const MAX_CONTEXT_SEGMENTS_PER_CHUNK = 100;

/**
 * Annotate a set of sentences with a given annotation character.
 * @param sentences A list of sentences to annotate.
 * @param annotationChar The character to use for annotation.
 * @returns The annotated string with annotation characters + sentence number.
 */
export function annotate(sentences, annotationChar, excludeIndices) {
  return sentences
    .map((sentence, i) => {
      const id = i + 1;
      if (excludeIndices && excludeIndices.has(id)) {
        return '';
      }
      return `<|${annotationChar}${id}|><${sentence}><end||${annotationChar}>`;
    })
    .join('');
}

/**
 * Annotates a chunk of indexed sentences with their global IDs.
 */
function annotateChunk(chunk, annotationChar) {
  return chunk
    .map(
      ({ sentence, globalId }) =>
        `<|${annotationChar}${globalId}|><${sentence}><end||${annotationChar}>`,
    )
    .join('');
}

export function getOffsets(originalString, sentences) {
  const offsets = new Map();
  let stringProgressPointer = 0;
  let sentenceId = 1;
  for (const sentence of sentences) {
    const stringToSearch = originalString.slice(stringProgressPointer);
    const startOffset =
      stringToSearch.indexOf(sentence) + stringProgressPointer;
    const endOffset = startOffset + sentence.length;
    stringProgressPointer = endOffset;
    offsets.set(sentenceId, { startOffset: startOffset, endOffset: endOffset });
    sentenceId++;
  }
  return offsets;
}

/**
 * Creates multiple HallOumi prompts by chunking context segments.
 * Each chunk uses global segment IDs (s5, s42, ...) so no local-to-global
 * mapping is needed when merging results.
 *
 * @returns {{ prompts: Array<{prompt, responseOffsets}> }}
 */
export function createChunkedHalloumiPrompts({
  indexedContextSentences,
  responseSentences,
  responseOffsets,
  request = 'Make one or more claims about information in the documents.',
  excludeResponseIndices,
}) {
  // Build response annotation (same for all chunks)
  const annotatedResponseSentences = annotate(
    responseSentences || [],
    'r',
    excludeResponseIndices,
  );
  const annotatedRequest = `<|request|><${request}><end||request>`;
  const annotatedResponse = `<|response|>${annotatedResponseSentences}<end||response>`;

  // Group sentences by source
  const sourceGroups = [];
  let currentSourceId = null;
  for (const s of indexedContextSentences) {
    if (s.sourceId !== currentSourceId) {
      sourceGroups.push([]);
      currentSourceId = s.sourceId;
    }
    sourceGroups[sourceGroups.length - 1].push(s);
  }

  // Pack whole sources into chunks (first-fit decreasing bin packing)
  // Sort by size descending so large sources get placed first
  const sorted = [...sourceGroups].sort((a, b) => b.length - a.length);
  const chunks = [];
  const chunkSizes = [];
  for (const group of sorted) {
    let placed = false;
    for (let c = 0; c < chunks.length; c++) {
      if (chunkSizes[c] + group.length <= MAX_CONTEXT_SEGMENTS_PER_CHUNK) {
        chunks[c].push(...group);
        chunkSizes[c] += group.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      chunks.push([...group]);
      chunkSizes.push(group.length);
    }
  }
  if (chunks.length === 0) chunks.push([]);

  // Build one prompt per chunk with global segment IDs
  const prompts = chunks.map((chunk) => {
    const annotatedContext = `<|context|>${annotateChunk(
      chunk,
      's',
    )}<end||context>`;
    const prompt = `${annotatedContext}${annotatedRequest}${annotatedResponse}`;

    return { prompt, responseOffsets };
  });

  return { prompts };
}
