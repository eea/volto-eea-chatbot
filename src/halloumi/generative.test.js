jest.mock('node-fetch');

import {
  halloumiGenerativeAPI,
  convertGenerativesClaimToVerifyClaimResponse,
  applyPlattScaling,
  getVerifyClaimResponse,
} from './generative';
import path from 'path';

describe('halloumiGenerativeAPI reads from mock file', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Most important - reset modules between test runs
    process.env = {
      ...originalEnv,
      MOCK_HALLOUMI_FILE_PATH: path.join(__dirname, '../dummy/qa-raw-3.json'),
    };
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env
    jest.restoreAllMocks(); // Restore all mocks
  });

  it('should read from the mock file when MOCK_LLM_CALL is true', async () => {
    const model = { name: 'test-model', apiUrl: 'http://test.com' };
    const prompt = {
      prompt: 'test-prompt',
      contextOffsets: new Map([[1, { startOffset: 0, endOffset: 10 }]]),
      responseOffsets: new Map([[1, { startOffset: 0, endOffset: 20 }]]),
    };

    // We are testing halloumiGenerativeAPI which internally calls getLLMResponse
    // and getLLMResponse uses the MOCK_LLM_CALL env variable.
    const response = await halloumiGenerativeAPI(model, prompt);

    expect(response[0].claimString).toEqual(
      '**France – total waste generation (latest available data)**  \n',
    );
    expect(response[0].segments).toEqual([
      38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    ]);
  });
});

describe('applyPlattScaling', () => {
  it('returns calibrated probability', () => {
    const platt = { a: -0.5764, b: 0.1665 };
    const result = applyPlattScaling(platt, 0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('clamps very low probability', () => {
    const platt = { a: -1, b: 0 };
    const result = applyPlattScaling(platt, 0);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('clamps very high probability', () => {
    const platt = { a: -1, b: 0 };
    const result = applyPlattScaling(platt, 1);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('returns 0.5 when platt params are zero', () => {
    const platt = { a: 0, b: 0 };
    const result = applyPlattScaling(platt, 0.5);
    expect(result).toBeCloseTo(0.5, 1);
  });
});

describe('getVerifyClaimResponse', () => {
  it('returns empty response when sources is empty', async () => {
    const result = await getVerifyClaimResponse({}, [], 'claims');
    expect(result).toEqual({ claims: [], segments: {} });
  });

  it('returns empty response when sources is null', async () => {
    const result = await getVerifyClaimResponse({}, null, 'claims');
    expect(result).toEqual({ claims: [], segments: {} });
  });

  it('returns empty response when claims is falsy', async () => {
    const result = await getVerifyClaimResponse({}, ['source'], null);
    expect(result).toEqual({ claims: [], segments: {} });
  });
});

describe('halloumiGenerativeAPI with plattScaling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MOCK_HALLOUMI_FILE_PATH: path.join(__dirname, '../dummy/qa-raw-3.json'),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('applies platt scaling when model has plattScaling config', async () => {
    const model = {
      name: 'test-model',
      apiUrl: 'http://test.com',
      plattScaling: { a: -0.5764, b: 0.1665 },
    };
    const prompt = {
      prompt: 'test-prompt',
      contextOffsets: new Map([[1, { startOffset: 0, endOffset: 10 }]]),
      responseOffsets: new Map([[1, { startOffset: 0, endOffset: 20 }]]),
    };

    const response = await halloumiGenerativeAPI(model, prompt);

    // With platt scaling, probabilities should be calibrated
    expect(response[0].probabilities).toBeDefined();
    const supported = response[0].probabilities.get('supported');
    const unsupported = response[0].probabilities.get('unsupported');
    expect(supported + unsupported).toBeCloseTo(1, 5);
  });
});

describe('halloumiGenerativeAPI via real fetch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Remove mock file path to exercise the fetch path
    process.env = { ...originalEnv };
    delete process.env.MOCK_HALLOUMI_FILE_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('calls fetch with correct parameters and auth header', async () => {
    // Mock postprocessing to control output and avoid format issues
    jest.doMock('./postprocessing', () => ({
      getClaimsFromResponse: jest.fn(() => [
        {
          claimId: 1,
          claimString: 'Test claim',
          subclaims: [],
          segments: [1],
          explanation: 'ok',
          supported: true,
        },
      ]),
      getTokenProbabilitiesFromLogits: jest.fn(() => [
        new Map([
          ['supported', 0.9],
          ['unsupported', 0.1],
        ]),
      ]),
    }));

    const { halloumiGenerativeAPI } = require('./generative');
    const nodeFetch = require('node-fetch');

    const mockResponse = {
      choices: [
        {
          message: { content: 'mock content' },
          logprobs: { content: [] },
        },
      ],
    };

    nodeFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const model = {
      name: 'test-model',
      apiUrl: 'http://test.com/api',
      apiKey: 'test-key',
    };
    const prompt = {
      prompt: 'test prompt',
      contextOffsets: new Map([[1, { startOffset: 0, endOffset: 10 }]]),
      responseOffsets: new Map([[1, { startOffset: 0, endOffset: 20 }]]),
    };

    const response = await halloumiGenerativeAPI(model, prompt);
    expect(response).toBeDefined();
    expect(Array.isArray(response)).toBe(true);
    expect(response[0].probabilities.get('supported')).toBe(0.9);

    // Verify fetch was called with auth header
    expect(nodeFetch).toHaveBeenCalledWith(
      'http://test.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });

  it('calls fetch without auth header when no apiKey', async () => {
    jest.doMock('./postprocessing', () => ({
      getClaimsFromResponse: jest.fn(() => [
        {
          claimId: 1,
          claimString: 'Test',
          subclaims: [],
          segments: [],
          explanation: 'ok',
          supported: true,
        },
      ]),
      getTokenProbabilitiesFromLogits: jest.fn(() => [
        new Map([
          ['supported', 0.8],
          ['unsupported', 0.2],
        ]),
      ]),
    }));

    const { halloumiGenerativeAPI } = require('./generative');
    const nodeFetch = require('node-fetch');

    nodeFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: { content: 'mock' },
              logprobs: { content: [] },
            },
          ],
        }),
    });

    const model = { name: 'test-model', apiUrl: 'http://test.com/api' };
    const prompt = { prompt: 'test', contextOffsets: new Map(), responseOffsets: new Map() };

    await halloumiGenerativeAPI(model, prompt);

    const callHeaders = nodeFetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('throws when token probabilities and claims do not match', async () => {
    jest.doMock('./postprocessing', () => ({
      getClaimsFromResponse: jest.fn(() => [
        { claimId: 1, claimString: 'Claim 1' },
        { claimId: 2, claimString: 'Claim 2' },
      ]),
      getTokenProbabilitiesFromLogits: jest.fn(() => [
        new Map([['supported', 0.9]]),
      ]),
    }));

    const { halloumiGenerativeAPI } = require('./generative');
    const nodeFetch = require('node-fetch');

    nodeFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: { content: 'mock' },
              logprobs: { content: [] },
            },
          ],
        }),
    });

    const model = { name: 'test-model', apiUrl: 'http://test.com' };
    const prompt = { prompt: 'test', contextOffsets: new Map(), responseOffsets: new Map() };

    await expect(halloumiGenerativeAPI(model, prompt)).rejects.toThrow(
      'Token probabilities and claims do not match',
    );
  });
});

describe('convertGenerativesClaimToVerifyClaimResponse', () => {
  it('should correctly convert generative claims to verify claim response', () => {
    const generativeClaims = [
      {
        claimId: 1,
        claimString: 'Test claim string',
        subclaims: ['subclaim1', 'subclaim2'],
        segments: [1, 2, 3],
        explanation: 'Test explanation',
        supported: true,
        probabilities: new Map([
          ['supported', 0.9],
          ['unsupported', 0.1],
        ]),
      },
    ];

    const prompt = {
      contextOffsets: new Map([[1, { startOffset: 0, endOffset: 10 }]]),
      responseOffsets: new Map([[1, { startOffset: 100, endOffset: 120 }]]),
    };

    const result = convertGenerativesClaimToVerifyClaimResponse(
      generativeClaims,
      prompt,
    );

    expect(result).toEqual({
      claims: [
        {
          claimId: 1,
          claimString: 'Test claim string',
          startOffset: 100,
          endOffset: 120,
          rationale: 'Test explanation',
          segmentIds: ['1', '2', '3'],
          score: 0.9,
        },
      ],
      segments: {
        1: { id: '1', startOffset: 0, endOffset: 10 },
      },
    });
  });

  it('throws when claim ID is not found in response offsets', () => {
    const generativeClaims = [
      {
        claimId: 999,
        claimString: 'Unknown claim',
        subclaims: [],
        segments: [],
        explanation: 'Missing',
        supported: false,
        probabilities: new Map([['supported', 0.1]]),
      },
    ];

    const prompt = {
      contextOffsets: new Map(),
      responseOffsets: new Map(),
    };

    expect(() =>
      convertGenerativesClaimToVerifyClaimResponse(generativeClaims, prompt),
    ).toThrow('Claim 999 not found in response offsets');
  });
});
