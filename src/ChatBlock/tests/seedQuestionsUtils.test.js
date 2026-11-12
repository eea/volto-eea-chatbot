import {
  extractQuestions,
  extractRelatedQuestions,
  buildSeedPrompt,
  buildQuestionsPrompt,
  loadCachedSeedQuestions,
  saveCachedSeedQuestions,
  normalizeTopics,
  sanitizeQuestionText,
  DEFAULT_SEED_QUESTIONS_COUNT,
  DEFAULT_SEED_QUESTIONS_CACHE_MINUTES,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/seedQuestions';

describe('seedQuestions utilities', () => {
  describe('extractQuestions', () => {
    it('returns empty array when input is empty or null', () => {
      expect(extractQuestions('')).toEqual([]);
      expect(extractQuestions(null)).toEqual([]);
      expect(extractQuestions(undefined)).toEqual([]);
    });

    it('returns empty array when response indicates no response', () => {
      expect(extractQuestions('NO_RESPONSE')).toEqual([]);
      expect(extractQuestions('There is no_response available.')).toEqual([]);
    });

    it('extracts questions from JSON array of strings', () => {
      const input = JSON.stringify([
        'What is climate change?',
        'How does air pollution affect health?',
      ]);
      expect(extractQuestions(input)).toEqual([
        'What is climate change?',
        'How does air pollution affect health?',
      ]);
    });

    it('extracts questions from JSON array of objects', () => {
      const input = JSON.stringify([
        { question: 'What is Natura 2000?' },
        { question: 'How are wetlands protected?' },
      ]);
      expect(extractQuestions(input)).toEqual([
        'What is Natura 2000?',
        'How are wetlands protected?',
      ]);
    });

    it('extracts questions from JSON object with questions array', () => {
      const input = JSON.stringify({
        questions: ['Question A', 'Question B'],
      });
      expect(extractQuestions(input)).toEqual(['Question A', 'Question B']);
    });

    it('extracts questions from numbered list format', () => {
      const input = `
        1. What is the greenhouse gas emission trend?
        2. How is biodiversity monitored?
        3. Which species are protected?
      `;
      expect(extractQuestions(input)).toEqual([
        'What is the greenhouse gas emission trend?',
        'How is biodiversity monitored?',
        'Which species are protected?',
      ]);
    });

    it('extracts questions from bullet points and dashes', () => {
      const input = `
        - What is the EU Green Deal?
        * How does circular economy work?
        • What are renewable energy targets?
      `;
      expect(extractQuestions(input)).toEqual([
        'What is the EU Green Deal?',
        'How does circular economy work?',
        'What are renewable energy targets?',
      ]);
    });

    it('handles mixed lines and trims extra whitespace', () => {
      const input = [
        '  1.   First question?  ',
        '  ',
        '  2. Second question?  ',
      ].join('\n');
      expect(extractQuestions(input)).toEqual([
        'First question?',
        'Second question?',
      ]);
    });
  });

  describe('extractRelatedQuestions', () => {
    it('returns array of RelatedQuestion objects for compatibility', () => {
      const input = `
        1. What is climate change?
        2. What is biodiversity?
      `;
      expect(extractRelatedQuestions(input)).toEqual([
        { question: 'What is climate change?' },
        { question: 'What is biodiversity?' },
      ]);
    });
  });

  describe('buildSeedPrompt', () => {
    it('builds prompt with persona only using description and forbidding persona name', () => {
      const prompt = buildSeedPrompt({
        persona: { name: 'Freshwater', description: 'European water data' },
      });
      expect(prompt).toContain(
        'Generate up to 4 questions that a user might ask about European water data',
      );
      expect(prompt).toContain('Do not mention or reference "Freshwater"');
    });

    it('builds prompt with persona name without description', () => {
      const prompt = buildSeedPrompt({
        persona: { name: 'Freshwater' },
        count: 5,
      });
      expect(prompt).toContain(
        'Generate up to 5 questions that a user might ask about Freshwater',
      );
      expect(prompt).toContain('Do not mention or reference "Freshwater"');
    });

    it('builds prompt with topics distributing questions evenly across topics', () => {
      const prompt = buildSeedPrompt({
        topics: ['Biodiversity', 'Air pollution'],
        count: 4,
      });
      expect(prompt).toContain('Generate exactly 4 starter questions');
      expect(prompt).toContain(
        'even distribution across the following topics:',
      );
      expect(prompt).toContain('- Biodiversity: 2 question(s)');
      expect(prompt).toContain('- Air pollution: 2 question(s)');
    });

    it('handles topics as newline-separated string and handles remainder distribution', () => {
      const prompt = buildSeedPrompt({
        topics: 'Rivers\nLakes\nGroundwater',
        count: 4,
      });
      expect(prompt).toContain('Generate exactly 4 starter questions');
      expect(prompt).toContain('- Rivers: 2 question(s)');
      expect(prompt).toContain('- Lakes: 1 question(s)');
      expect(prompt).toContain('- Groundwater: 1 question(s)');
    });

    it('builds prompt with both persona and topics distributing questions evenly and forbidding agent name in questions', () => {
      const prompt = buildSeedPrompt({
        persona: { name: 'Climate-ADAPT', description: 'Adaptation platform' },
        topics: ['extreme heat', 'flooding'],
        count: 6,
      });
      expect(prompt).toContain(
        'Generate exactly 6 starter questions that a user might ask, with an even distribution across the following topics:',
      );
      expect(prompt).toContain('- extreme heat: 3 question(s)');
      expect(prompt).toContain('- flooding: 3 question(s)');
      expect(prompt).toContain('Do not mention or reference "Climate-ADAPT"');
    });

    it('builds generic prompt when neither persona nor topics are provided', () => {
      const prompt = buildSeedPrompt();
      expect(prompt).toContain(
        'Generate up to 4 questions that a user might ask, based on the retrieved documents.',
      );
    });
  });

  describe('sanitizeQuestionText', () => {
    it('removes "according to the [persona]" from the end of questions', () => {
      const q =
        'What are the latest trends in CO2 emissions across European regions according to the EEA Green Guru?';
      expect(sanitizeQuestionText(q, 'EEA Green Guru')).toBe(
        'What are the latest trends in CO2 emissions across European regions?',
      );
    });

    it('replaces "in the [persona] reports" with "in reports"', () => {
      const q =
        'Which pollutants are identified as the most significant health threats in the EEA Green Guru reports?';
      expect(sanitizeQuestionText(q, 'EEA Green Guru')).toBe(
        'Which pollutants are identified as the most significant health threats in reports?',
      );
    });

    it('replaces "does [persona] monitor" with "is monitored"', () => {
      const q =
        'How does the EEA Green Guru monitor changes in water quality across European river basins?';
      expect(sanitizeQuestionText(q, 'EEA Green Guru')).toBe(
        'How is monitored changes in water quality across European river basins?',
      );
    });
  });

  describe('normalizeTopics', () => {
    it('normalizes object_list array of { topic: string }', () => {
      const input = [{ topic: 'Biodiversity' }, { topic: 'Freshwater' }];
      expect(normalizeTopics(input)).toEqual(['Biodiversity', 'Freshwater']);
    });

    it('normalizes array of strings', () => {
      const input = ['Topic 1', ' Topic 2 '];
      expect(normalizeTopics(input)).toEqual(['Topic 1', 'Topic 2']);
    });

    it('normalizes newline-separated string', () => {
      const input = 'Topic A\n\nTopic B\n';
      expect(normalizeTopics(input)).toEqual(['Topic A', 'Topic B']);
    });

    it('returns empty array for empty, null, or undefined', () => {
      expect(normalizeTopics(null)).toEqual([]);
      expect(normalizeTopics(undefined)).toEqual([]);
      expect(normalizeTopics([])).toEqual([]);
      expect(normalizeTopics('')).toEqual([]);
    });
  });

  describe('single source of truth defaults', () => {
    it('defines default seed questions count and cache minutes', () => {
      expect(DEFAULT_SEED_QUESTIONS_COUNT).toBe(4);
      expect(DEFAULT_SEED_QUESTIONS_CACHE_MINUTES).toBe(10);
    });
  });

  describe('localStorage caching helpers', () => {
    let mockStorage = {};

    beforeEach(() => {
      mockStorage = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key) => mockStorage[key] || null),
          setItem: jest.fn((key, val) => {
            mockStorage[key] = val;
          }),
          removeItem: jest.fn((key) => {
            delete mockStorage[key];
          }),
        },
        writable: true,
      });
    });

    it('saves and loads cached seed questions within TTL', () => {
      const questions = ['Q1?', 'Q2?'];
      saveCachedSeedQuestions('test-key', questions);

      const loaded = loadCachedSeedQuestions('test-key', 60);
      expect(loaded).toEqual(questions);
    });

    it('returns null when cached entry has expired based on default cacheMinutes (10 mins)', () => {
      const questions = ['Q1?'];
      const expiredEntry = {
        timestamp: Date.now() - 11 * 60 * 1000, // 11 minutes ago (exceeds default 10)
        questions,
      };
      mockStorage['expired-key'] = JSON.stringify(expiredEntry);

      const loaded = loadCachedSeedQuestions('expired-key');
      expect(loaded).toBeNull();
    });

    it('returns cached questions when within default cacheMinutes (10 mins)', () => {
      const questions = ['Q1?'];
      const validEntry = {
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago (within default 10)
        questions,
      };
      mockStorage['valid-key'] = JSON.stringify(validEntry);

      const loaded = loadCachedSeedQuestions('valid-key');
      expect(loaded).toEqual(questions);
    });

    it('returns null when cache entry is invalid JSON or empty', () => {
      mockStorage['bad-key'] = 'not-json';
      expect(loadCachedSeedQuestions('bad-key')).toBeNull();

      mockStorage['empty-key'] = JSON.stringify({ questions: [] });
      expect(loadCachedSeedQuestions('empty-key')).toBeNull();
    });
  });

  describe('buildQuestionsPrompt', () => {
    it('builds follow-up prompt when query and answer are present', () => {
      const prompt = buildQuestionsPrompt({
        query: 'What is climate change?',
        answer: 'Climate change is long-term shifts in temperatures.',
      });
      expect(prompt).toBe(
        'Question: What is climate change?\nAnswer:\nClimate change is long-term shifts in temperatures.',
      );
    });

    it('delegates to buildSeedPrompt when query or answer is missing', () => {
      const prompt = buildQuestionsPrompt({
        topics: ['Circular economy'],
      });
      expect(prompt).toContain(
        'even distribution across the following topics:',
      );
      expect(prompt).toContain('- Circular economy: 4 question(s)');
    });
  });
});
