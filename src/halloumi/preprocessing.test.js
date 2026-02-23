import {
  createChunkedHalloumiPrompts,
  annotate,
  getOffsets,
} from './preprocessing';

describe('annotate', () => {
  it('should annotate multiple sentences correctly', () => {
    const sentences = ['Sentence one.', 'Sentence two.'];
    const annotationChar = 's';
    const expected =
      '<|s1|><Sentence one.><end||s><|s2|><Sentence two.><end||s>';
    expect(annotate(sentences, annotationChar)).toEqual(expected);
  });

  it('should handle an empty array of sentences', () => {
    const sentences = [];
    const annotationChar = 's';
    expect(annotate(sentences, annotationChar)).toEqual('');
  });

  it('should annotate a single sentence', () => {
    const sentences = ['Single sentence.'];
    const annotationChar = 'r';
    const expected = '<|r1|><Single sentence.><end||r>';
    expect(annotate(sentences, annotationChar)).toEqual(expected);
  });

  it('should use different annotation characters', () => {
    const sentences = ['Hello.'];
    const annotationChar = 'x';
    const expected = '<|x1|><Hello.><end||x>';
    expect(annotate(sentences, annotationChar)).toEqual(expected);
  });
});

describe('getOffsets', () => {
  it('should calculate correct offsets for multiple sentences', () => {
    const originalString = 'First sentence. Second sentence. Third sentence.';
    const sentences = [
      'First sentence. ',
      'Second sentence. ',
      'Third sentence.',
    ];
    const expected = new Map([
      [1, { startOffset: 0, endOffset: 16 }],
      [2, { startOffset: 16, endOffset: 33 }],
      [3, { startOffset: 33, endOffset: 48 }],
    ]);
    expect(getOffsets(originalString, sentences)).toEqual(expected);
  });

  it('should handle empty original string and sentences', () => {
    const originalString = '';
    const sentences = [];
    expect(getOffsets(originalString, sentences)).toEqual(new Map());
  });

  it('should handle original string matching sentences exactly', () => {
    const originalString = 'Hello world.';
    const sentences = ['Hello world.'];
    const expected = new Map([[1, { startOffset: 0, endOffset: 12 }]]);
    expect(getOffsets(originalString, sentences)).toEqual(expected);
  });

  it('should handle original string with leading/trailing spaces', () => {
    const originalString = '  Sentence one.  Sentence two.  ';
    const sentences = ['Sentence one.  ', 'Sentence two.  '];
    const expected = new Map([
      [1, { startOffset: 2, endOffset: 17 }],
      [2, { startOffset: 17, endOffset: 32 }],
    ]);
    expect(getOffsets(originalString, sentences)).toEqual(expected);
  });

  it('should handle sentences with special characters', () => {
    const originalString = 'Sentence with !@#$%^&*() special characters.';
    const sentences = ['Sentence with !@#$%^&*() special characters.'];
    const expected = new Map([[1, { startOffset: 0, endOffset: 44 }]]);
    expect(getOffsets(originalString, sentences)).toEqual(expected);
  });
});

describe('createChunkedHalloumiPrompts', () => {
  it('should create a single chunk for small input', () => {
    const indexedContextSentences = [
      { sentence: 'Context one.', sourceId: 1, globalId: 1 },
      { sentence: 'Context two.', sourceId: 1, globalId: 2 },
    ];
    const responseSentences = ['Response one.', 'Response two.'];
    const responseOffsets = new Map([
      [1, { startOffset: 0, endOffset: 13 }],
      [2, { startOffset: 14, endOffset: 28 }],
    ]);

    const { prompts } = createChunkedHalloumiPrompts({
      indexedContextSentences,
      responseSentences,
      responseOffsets,
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0].prompt).toContain('<|s1|><Context one.><end||s>');
    expect(prompts[0].prompt).toContain('<|s2|><Context two.><end||s>');
    expect(prompts[0].prompt).toContain('<|r1|><Response one.><end||r>');
    expect(prompts[0].prompt).toContain('<|r2|><Response two.><end||r>');
  });

  it('should handle empty context', () => {
    const responseSentences = ['Response.'];
    const responseOffsets = new Map([[1, { startOffset: 0, endOffset: 9 }]]);

    const { prompts } = createChunkedHalloumiPrompts({
      indexedContextSentences: [],
      responseSentences,
      responseOffsets,
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0].prompt).toContain('<|context|><end||context>');
  });

  it('should exclude response sentences based on excludeResponseIndices', () => {
    const indexedContextSentences = [
      { sentence: 'Context.', sourceId: 1, globalId: 1 },
    ];
    const responseSentences = ['Keep this.', 'Skip this.', 'Keep too.'];
    const responseOffsets = new Map([
      [1, { startOffset: 0, endOffset: 10 }],
      [2, { startOffset: 11, endOffset: 21 }],
      [3, { startOffset: 22, endOffset: 31 }],
    ]);
    const excludeResponseIndices = new Set([2]);

    const { prompts } = createChunkedHalloumiPrompts({
      indexedContextSentences,
      responseSentences,
      responseOffsets,
      excludeResponseIndices,
    });

    expect(prompts[0].prompt).toContain('<|r1|><Keep this.><end||r>');
    expect(prompts[0].prompt).not.toContain('Skip this.');
    expect(prompts[0].prompt).toContain('<|r3|><Keep too.><end||r>');
  });

  it('should keep sources together with bin packing', () => {
    // 3 sources: 60 + 60 + 30 = 150 sentences
    // Should pack into 2 chunks: (60+30) and (60) or similar
    const indexed = [];
    let gid = 1;
    // Source 1: 60 sentences
    for (let i = 0; i < 60; i++) {
      indexed.push({ sentence: `S1-${i}`, sourceId: 1, globalId: gid++ });
    }
    // Source 2: 60 sentences
    for (let i = 0; i < 60; i++) {
      indexed.push({ sentence: `S2-${i}`, sourceId: 2, globalId: gid++ });
    }
    // Source 3: 30 sentences
    for (let i = 0; i < 30; i++) {
      indexed.push({ sentence: `S3-${i}`, sourceId: 3, globalId: gid++ });
    }

    const { prompts } = createChunkedHalloumiPrompts({
      indexedContextSentences: indexed,
      responseSentences: ['Claim.'],
      responseOffsets: new Map([[1, { startOffset: 0, endOffset: 6 }]]),
    });

    expect(prompts).toHaveLength(2);

    // Each source should be entirely within one chunk
    for (const prompt of prompts) {
      const s1Count = (prompt.prompt.match(/S1-/g) || []).length;
      const s2Count = (prompt.prompt.match(/S2-/g) || []).length;
      const s3Count = (prompt.prompt.match(/S3-/g) || []).length;

      if (s1Count > 0) expect(s1Count).toBe(60);
      if (s2Count > 0) expect(s2Count).toBe(60);
      if (s3Count > 0) expect(s3Count).toBe(30);
    }
  });
});
