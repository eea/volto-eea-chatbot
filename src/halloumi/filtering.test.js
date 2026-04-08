import fetch from 'node-fetch';

import {
  parseExcludeIndices,
  callLLM,
  excludeClaimSentences,
  excludeContextSentences,
} from './filtering';
jest.mock('node-fetch');

describe('parseExcludeIndices', () => {
  it('parses single indices', () => {
    const result = parseExcludeIndices('1,3,5', 6);
    expect(result).toEqual(new Set([1, 3, 5]));
  });

  it('returns empty set for NONE', () => {
    const result = parseExcludeIndices('NONE', 10);
    expect(result).toEqual(new Set());
  });

  it('returns empty set for none (lowercase)', () => {
    const result = parseExcludeIndices('  none  ', 10);
    expect(result).toEqual(new Set());
  });

  it('ignores indices below 1', () => {
    const result = parseExcludeIndices('0, 1, 3', 5);
    expect(result).toEqual(new Set([1, 3]));
  });

  it('ignores indices above maxIndex', () => {
    const result = parseExcludeIndices('1, 3, 99', 5);
    expect(result).toEqual(new Set([1, 3]));
  });

  it('handles whitespace variations', () => {
    const result = parseExcludeIndices('  1 ,  5 , 7  ', 10);
    expect(result).toEqual(new Set([1, 5, 7]));
  });

  it('extracts numbers even from unexpected formats', () => {
    // Parser uses match(/\d+/g) so it extracts all numbers
    const result = parseExcludeIndices('1-3, 5', 10);
    expect(result).toEqual(new Set([1, 3, 5]));
  });

  it('returns empty set for empty string with no numbers', () => {
    const result = parseExcludeIndices('no numbers here', 10);
    expect(result).toEqual(new Set());
  });
});

describe('callLLM', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  afterEach(() => {
    fetch.mockReset();
  });

  it('makes POST request with correct headers', async () => {
    const mockResponse = { choices: [{ message: { content: 'result' } }] };
    fetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    await callLLM('https://api.example.com', 'my-api-key', { model: 'gpt-4' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer my-api-key',
        }),
      }),
    );
  });

  it('omits Authorization header when no apiKey', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    await callLLM('https://api.example.com', null, { model: 'gpt-4' });

    const headers = fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('adds X-Forwarded-For header when ip is provided', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    await callLLM('https://api.example.com', null, {}, { ip: '1.2.3.4' });

    const headers = fetch.mock.calls[0][1].headers;
    expect(headers['X-Forwarded-For']).toBe('1.2.3.4');
  });

  it('returns parsed JSON response', async () => {
    const mockResponse = { choices: [{ message: { content: 'hello' } }] };
    fetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await callLLM('https://api.example.com', null, {});
    expect(result).toEqual(mockResponse);
  });
});

describe('excludeClaimSentences', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  afterEach(() => {
    fetch.mockReset();
  });

  it('returns empty set for empty sentences array', async () => {
    const result = await excludeClaimSentences([]);
    expect(result).toEqual(new Set());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls LLM and returns excluded sentence indices', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '1,3' } }],
        }),
    });

    const sentences = ['Sentence one.', 'Sentence two.', 'Sentence three.'];
    const result = await excludeClaimSentences(sentences);

    expect(result).toEqual(new Set([1, 3]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns empty set when LLM returns NONE', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'NONE' } }],
        }),
    });

    const sentences = ['Some factual sentence.', 'Another factual sentence.'];
    const result = await excludeClaimSentences(sentences);

    expect(result).toEqual(new Set());
  });

  it('returns empty set on LLM error', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    const sentences = ['Sentence one.'];
    const result = await excludeClaimSentences(sentences);

    expect(result).toEqual(new Set());
  });

  it('passes ip option to LLM call', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ choices: [{ message: { content: 'NONE' } }] }),
    });

    await excludeClaimSentences(['test sentence'], { ip: '10.0.0.1' });

    const headers = fetch.mock.calls[0][1].headers;
    expect(headers['X-Forwarded-For']).toBe('10.0.0.1');
  });
});

describe('excludeContextSentences', () => {
  const MIN_SENTENCES = 75;

  beforeEach(() => {
    fetch.mockReset();
  });

  afterEach(() => {
    fetch.mockReset();
  });

  it('returns empty set when context sentences <= minimum threshold', async () => {
    const shortContext = Array(10).fill('Short sentence.');
    const claims = ['A claim.'];
    const result = await excludeContextSentences(shortContext, claims);

    expect(result).toEqual(new Set());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls LLM when context exceeds minimum threshold', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '1,2' } }],
        }),
    });

    const longContext = Array(MIN_SENTENCES + 1).fill('Context sentence.');
    const claims = ['A claim.'];
    const result = await excludeContextSentences(longContext, claims);

    expect(result).toEqual(new Set([1, 2]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns empty set on LLM error', async () => {
    fetch.mockRejectedValue(new Error('timeout'));

    const longContext = Array(MIN_SENTENCES + 1).fill('Context sentence.');
    const claims = ['A claim.'];
    const result = await excludeContextSentences(longContext, claims);

    expect(result).toEqual(new Set());
  });

  it('returns empty set when LLM returns NONE for context', async () => {
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'NONE' } }],
        }),
    });

    const longContext = Array(MIN_SENTENCES + 1).fill('Context sentence.');
    const claims = ['A claim.'];
    const result = await excludeContextSentences(longContext, claims);

    expect(result).toEqual(new Set());
  });
});
