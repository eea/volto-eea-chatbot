/**
 * Single source of truth for seed questions default configuration.
 */
export const DEFAULT_SEED_QUESTIONS_COUNT = 4;
export const DEFAULT_SEED_QUESTIONS_CACHE_MINUTES = 10;

/**
 * Utility functions for extracting and parsing seed and related questions.
 */

/**
 * Sanitize question text to remove unwanted references to the assistant name.
 *
 * @param {string} question
 * @param {string} [personaName]
 * @returns {string}
 */
export function sanitizeQuestionText(question, personaName) {
  if (!question || typeof question !== 'string') return '';
  let cleaned = question.trim();
  if (personaName && typeof personaName === 'string') {
    const escaped = personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Remove leading "According to (the )?PersonaName, "
    cleaned = cleaned.replace(
      new RegExp(`^according\\s+to\\s+(the\\s+)?${escaped}\\s*,?\\s*`, 'gi'),
      '',
    );
    // Remove trailing "according to (the )?PersonaName?"
    cleaned = cleaned.replace(
      new RegExp(
        `\\s*,?\\s*according\\s+to\\s+(the\\s+)?${escaped}\\b\\??$`,
        'gi',
      ),
      '?',
    );
    // Replace "in (the )?PersonaName reports" with "in reports"
    cleaned = cleaned.replace(
      new RegExp(`\\bin\\s+(the\\s+)?${escaped}\\s+reports\\b`, 'gi'),
      'in reports',
    );
    // Replace "does (the )?PersonaName monitor" with "is monitored"
    cleaned = cleaned.replace(
      new RegExp(`\\bdoes\\s+(the\\s+)?${escaped}\\s+monitor\\b`, 'gi'),
      'is monitored',
    );
    // Clean up any remaining direct references to the persona name
    cleaned = cleaned.replace(
      new RegExp(`\\s*\\b(the\\s+)?${escaped}\\b\\s*`, 'gi'),
      ' ',
    );
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (!cleaned.endsWith('?') && question.endsWith('?')) {
      cleaned += '?';
    }
  }
  return cleaned;
}

/**
 * Extract array of question strings from an LLM response string
 * Supports JSON arrays, JSON objects with questions property, numbered lists, and bullet points.
 *
 * @param {string} str - Raw response string from Onyx
 * @param {string} [personaName] - Optional persona name to strip from questions
 * @returns {string[]} Array of extracted question strings
 */
export function extractQuestions(str, personaName) {
  if (
    !str ||
    typeof str !== 'string' ||
    str.toLowerCase().includes('no_response')
  ) {
    return [];
  }

  const trimmed = str.trim();
  let rawQuestions = [];

  // Try to parse as JSON first if it looks like JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.questions || [];
      if (Array.isArray(items)) {
        rawQuestions = items
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (
              item &&
              typeof item === 'object' &&
              typeof item.question === 'string'
            ) {
              return item.question.trim();
            }
            return null;
          })
          .filter((q) => Boolean(q));
      }
    } catch {
      // Fallback to line parsing
    }
  }

  // Fallback: split by lines and clean up common list formats (1., -, *, etc.)
  if (rawQuestions.length === 0) {
    rawQuestions = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Discard raw JSON objects/arrays in streaming packet fallbacks
        if (line.startsWith('{') || line.startsWith('[')) {
          return null;
        }
        // Remove leading numbers, bullets, dashes, dots, spaces (e.g. "1. ", "- ", "* ", "• ")
        const cleaned = line.replace(/^[\d.\-*•\s]+/, '').trim();
        return cleaned || null;
      })
      .filter((q) => Boolean(q));
  }

  if (personaName) {
    return rawQuestions
      .map((q) => sanitizeQuestionText(q, personaName))
      .filter(Boolean);
  }

  return rawQuestions;
}

/**
 * Extract array of { question: string } objects (used by useChatController)
 *
 * @param {string} str - Raw response string from Onyx
 * @returns {{ question: string }[]}
 */
export function extractRelatedQuestions(str) {
  return extractQuestions(str).map((q) => ({ question: q }));
}

/**
 * Normalize topics into an array of non-empty strings.
 * Supports string arrays, newline-delimited strings, and object lists (e.g. [{ topic: '...' }]).
 *
 * @param {Array|string} [topics]
 * @returns {string[]}
 */
export function normalizeTopics(topics) {
  if (!topics) return [];
  if (Array.isArray(topics)) {
    return topics
      .map((t) => {
        if (typeof t === 'string') return t.trim();
        if (t && typeof t === 'object') {
          return (t.topic || t.title || t.name || t.value || '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof topics === 'string') {
    return topics
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Build the prompt for seed questions based on persona and/or topics.
 * Ensures an even distribution across all specified topics.
 *
 * @param {object} [options]
 * @param {Array|string} [options.topics]
 * @param {number} [options.count]
 * @param {object} [options.persona]
 * @param {string} [options.persona.name]
 * @param {string} [options.persona.description]
 * @returns {string}
 */
export function buildSeedPrompt({
  topics,
  count = DEFAULT_SEED_QUESTIONS_COUNT,
  persona,
} = {}) {
  const normalizedTopics = normalizeTopics(topics);
  const targetCount =
    Number(count) > 0 ? Number(count) : DEFAULT_SEED_QUESTIONS_COUNT;
  const hasPersona = Boolean(persona?.name);
  const hasTopics = normalizedTopics.length > 0;

  const agentRule = persona?.name
    ? `\n- Do not mention or reference "${persona.name}" or any assistant/agent name in the questions. Ask direct, natural questions about the subject matter.`
    : '\n- Do not mention or reference any assistant, agent, or chatbot name in the questions.';

  if (hasTopics) {
    const basePerTopic = Math.floor(targetCount / normalizedTopics.length);
    const remainder = targetCount % normalizedTopics.length;
    const distributionGuide = normalizedTopics
      .map((t, idx) => {
        const topicCount = basePerTopic + (idx < remainder ? 1 : 0);
        return topicCount > 0 ? `- ${t}: ${topicCount} question(s)` : null;
      })
      .filter(Boolean)
      .join('\n');

    return `Generate exactly ${targetCount} starter questions that a user might ask, with an even distribution across the following topics:\n${distributionGuide}\n\nBased on the retrieved documents, output only questions, one per line, no numbering, no preamble.${agentRule}`;
  }

  if (hasPersona) {
    const domain = persona.description || persona.name;
    return `Generate up to ${targetCount} questions that a user might ask about ${domain}, based on the retrieved documents.\nOutput only questions, one per line, no numbering, no preamble.${agentRule}`;
  }

  return `Generate up to ${targetCount} questions that a user might ask, based on the retrieved documents.\nOutput only questions, one per line, no numbering, no preamble.${agentRule}`;
}

/**
 * Build the unified questions prompt.
 * If query and answer are provided, builds follow-up related questions turn.
 * Otherwise, builds seed questions prompt based on topics and persona.
 *
 * @param {object} [options]
 * @param {string} [options.query]
 * @param {string} [options.answer]
 * @param {Array|string} [options.topics]
 * @param {number} [options.count]
 * @param {object} [options.persona]
 * @returns {string}
 */
export function buildQuestionsPrompt({
  query,
  answer,
  topics,
  count = DEFAULT_SEED_QUESTIONS_COUNT,
  persona,
} = {}) {
  if (query && answer) {
    return `Question: ${query}\nAnswer:\n${answer}`;
  }
  return buildSeedPrompt({ topics, count, persona });
}

/**
 * Read cached seed questions from localStorage if present and not expired.
 * Cache is strictly time-based: remains valid until cacheMinutes expire.
 *
 * @param {string} cacheKey
 * @param {number} [cacheMinutes]
 * @returns {string[]|null}
 */
export function loadCachedSeedQuestions(
  cacheKey,
  cacheMinutes = DEFAULT_SEED_QUESTIONS_CACHE_MINUTES,
) {
  if (typeof window === 'undefined' || !window.localStorage || !cacheKey) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (
      !entry ||
      !Array.isArray(entry.questions) ||
      entry.questions.length === 0
    ) {
      return null;
    }
    const maxAgeMs =
      (Number(cacheMinutes) > 0
        ? Number(cacheMinutes)
        : DEFAULT_SEED_QUESTIONS_CACHE_MINUTES) *
      60 *
      1000;
    const ageMs = Date.now() - (entry.timestamp || 0);
    if (ageMs >= maxAgeMs) {
      return null;
    }

    return entry.questions;
  } catch {
    return null;
  }
}

/**
 * Save generated seed questions to localStorage.
 *
 * @param {string} cacheKey
 * @param {string[]} questions
 */
export function saveCachedSeedQuestions(cacheKey, questions) {
  if (
    typeof window === 'undefined' ||
    !window.localStorage ||
    !cacheKey ||
    !Array.isArray(questions)
  ) {
    return;
  }
  try {
    const entry = {
      timestamp: Date.now(),
      questions,
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Ignore storage quota or security errors
  }
}
