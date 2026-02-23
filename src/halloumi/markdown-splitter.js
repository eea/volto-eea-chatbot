import nlp from 'compromise';

const MIN_SENTENCE_LENGTH = 15;

/**
 * Splits markdown text into segments meaningful for fact-checking.
 *
 * Strategy:
 * 1. Split into markdown blocks (paragraphs, list items, table rows, headers)
 * 2. For prose blocks, further split into sentences using Intl.Segmenter
 * 3. Merge short fragments (< MIN_SENTENCE_LENGTH) into the next sentence
 *
 * Structural blocks (table rows, headers, list items) are kept as-is since
 * they are already atomic units.
 *
 * @param {string} text Markdown text to split.
 * @returns {string[]} Array of segment strings.
 */
export function splitMarkdown(text) {
  const blocks = splitIntoBlocks(text);
  const segments = [];

  for (const block of blocks) {
    if (isStructuralBlock(block)) {
      if (block.trim().length > 0) {
        segments.push(block);
      }
    } else {
      segments.push(...splitProse(block));
    }
  }

  return segments;
}

/**
 * Splits markdown text into structural blocks.
 * Separates: headers, table rows, list items, horizontal rules, and prose.
 * Prose lines within the same paragraph are joined together.
 */
function splitIntoBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentProse = '';

  const flushProse = () => {
    if (currentProse) {
      blocks.push(currentProse);
      currentProse = '';
    }
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (isTableRow(trimmed)) {
      flushProse();
      blocks.push(line);
    } else if (isTableSeparator(trimmed)) {
      flushProse();
      // Skip separator rows — not verifiable content
    } else if (isHeader(trimmed)) {
      flushProse();
      blocks.push(line);
    } else if (isHorizontalRule(trimmed)) {
      flushProse();
      // Skip horizontal rules
    } else if (isListItem(trimmed)) {
      flushProse();
      blocks.push(line);
    } else if (trimmed === '') {
      flushProse();
    } else {
      // Prose continuation — join into a single paragraph
      currentProse += (currentProse ? ' ' : '') + line.trim();
    }
  }

  flushProse();
  return blocks;
}

function isTableRow(line) {
  return /^\|.*\|/.test(line) && !isTableSeparator(line);
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line);
}

function isHeader(line) {
  return /^#{1,6}\s/.test(line);
}

function isHorizontalRule(line) {
  return /^(\*{3,}|-{3,}|_{3,})\s*$/.test(line);
}

function isListItem(line) {
  return /^(\d+\.\s+|[-*+]\s+)/.test(line);
}

/**
 * Returns true if a block is structural (table row, header, list item)
 * and should not be further split into sentences.
 */
function isStructuralBlock(block) {
  const trimmed = block.trimStart();
  return isTableRow(trimmed) || isHeader(trimmed) || isListItem(trimmed);
}

/**
 * Splits a prose paragraph into sentences using sbd (sentence boundary detection),
 * merging short fragments that aren't independently verifiable.
 * sbd handles abbreviations (Dr., Mr., U.S., Ph.D.) correctly.
 */
export function splitProse(text, maxSentences = 0) {
  // const segments = segment('en', text);
  const doc = nlp(text);
  const initialSentences = doc.sentences().out('array');

  // Find each sentence's position in the original text
  const positions = getPositions(text, initialSentences);

  // Merge short sentences (< MIN_SENTENCE_LENGTH) into the next sentence
  const merged = [];
  const mergedPositions = [];
  let pendingStart = null;
  for (let i = 0; i < initialSentences.length; i++) {
    if (pendingStart === null) {
      pendingStart = positions[i].start;
    }
    if (
      initialSentences[i].replaceAll('\n', '').length < MIN_SENTENCE_LENGTH &&
      i < initialSentences.length - 1
    ) {
      // Too short — will be merged with the next sentence
      continue;
    }
    const s = text.slice(pendingStart, positions[i].end);
    merged.push(s);
    mergedPositions.push({ start: pendingStart, end: positions[i].end });
    pendingStart = null;
  }

  if (maxSentences && merged.length > maxSentences) {
    // Merge groups by slicing original text to preserve separators
    const groupSize = Math.ceil(merged.length / maxSentences);
    const groupedSentences = [];
    for (let i = 0; i < merged.length; i += groupSize) {
      const groupStart = mergedPositions[i].start;
      const groupEnd =
        mergedPositions[Math.min(i + groupSize, merged.length) - 1].end;
      groupedSentences.push(text.slice(groupStart, groupEnd));
    }
    return groupedSentences;
  }

  return merged;
}

function getPositions(text, sentences) {
  const positions = [];
  let searchFrom = 0;
  for (const sentence of sentences) {
    const start = text.indexOf(sentence, searchFrom);
    const end = start + sentence.length;
    positions.push({ start, end });
    searchFrom = end;
  }
  return positions;
}
