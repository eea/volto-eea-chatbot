import { TextEncoder, TextDecoder } from 'util';

import {
  processRawChunkString,
  handleStream,
  createChatSession,
  submitFeedback,
  regenerateMessage,
} from '../services/streamingService';
import { PacketType } from '../types/streamingModels';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// ── processRawChunkString ──────────────────────────────────────────────

describe('processRawChunkString', () => {
  it('returns empty array for empty string', () => {
    const [chunks, partial] = processRawChunkString('', null);
    expect(chunks).toEqual([]);
    expect(partial).toBeNull();
  });

  it('parses a single complete JSON chunk', () => {
    const raw = JSON.stringify({ ind: 1, obj: { type: 'message_delta' } });
    const [chunks, partial] = processRawChunkString(raw, null);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ ind: 1, obj: { type: 'message_delta' } });
    expect(partial).toBeNull();
  });

  it('parses multiple newline-separated JSON chunks', () => {
    const c1 = JSON.stringify({ ind: 1, obj: { type: 'message_start' } });
    const c2 = JSON.stringify({ ind: 2, obj: { type: 'message_delta' } });
    const raw = `${c1}\n${c2}`;
    const [chunks, partial] = processRawChunkString(raw, null);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].ind).toBe(1);
    expect(chunks[1].ind).toBe(2);
    expect(partial).toBeNull();
  });

  it('handles incomplete chunk and returns it as partial', () => {
    const raw = '{"ind": 1, "obj": {"type"';
    const [chunks, partial] = processRawChunkString(raw, null);
    expect(chunks).toHaveLength(0);
    expect(partial).toBe(raw);
  });

  it('combines previous partial chunk with new data', () => {
    const prev = '{"ind": 1, "obj": {"type"';
    const rest = ': "message_delta"}}';
    const [chunks, partial] = processRawChunkString(rest, prev);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ ind: 1, obj: { type: 'message_delta' } });
    expect(partial).toBeNull();
  });

  it('filters out empty lines', () => {
    const c1 = JSON.stringify({ ind: 1, obj: { type: 'stop' } });
    const raw = `\n${c1}\n\n`;
    const [chunks, partial] = processRawChunkString(raw, null);
    expect(chunks).toHaveLength(1);
    expect(partial).toBeNull();
  });

  it('returns null for falsy input', () => {
    const [chunks, partial] = processRawChunkString(null, null);
    expect(chunks).toEqual([]);
    expect(partial).toBeNull();
  });
});

// ── handleStream ───────────────────────────────────────────────────────

describe('handleStream', () => {
  function makeReadableStream(chunks) {
    let index = 0;
    return {
      body: {
        getReader() {
          return {
            async read() {
              if (index >= chunks.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(chunks[index++]);
              return { done: false, value };
            },
          };
        },
      },
    };
  }

  it('yields packets from a stream with ind/obj format', async () => {
    const packet = JSON.stringify({
      ind: 1,
      obj: { type: PacketType.MESSAGE_DELTA, content: 'hello' },
    });
    const response = makeReadableStream([packet]);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(1);
    expect(allPackets[0].obj.type).toBe(PacketType.MESSAGE_DELTA);
  });

  it('handles MessageResponseIDInfo format', async () => {
    const chunk = JSON.stringify({
      user_message_id: 42,
      reserved_assistant_message_id: 43,
    });
    const response = makeReadableStream([chunk]);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(1);
    expect(allPackets[0].obj.type).toBe(PacketType.MESSAGE_END_ID_INFO);
    expect(allPackets[0].obj.user_message_id).toBe(42);
  });

  it('handles error format', async () => {
    const chunk = JSON.stringify({ error: 'something went wrong' });
    const response = makeReadableStream([chunk]);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(1);
    expect(allPackets[0].obj.type).toBe(PacketType.ERROR);
    expect(allPackets[0].obj.error).toBe('something went wrong');
  });

  it('throws when no reader is available', async () => {
    const response = { body: null };
    const gen = handleStream(response);
    await expect(gen.next()).rejects.toThrow('No reader available');
  });

  it('handles multiple chunks across reads', async () => {
    const c1 = JSON.stringify({
      ind: 1,
      obj: { type: PacketType.MESSAGE_START, content: 'hi' },
    });
    const c2 = JSON.stringify({
      ind: 2,
      obj: { type: PacketType.MESSAGE_DELTA, content: ' world' },
    });
    const response = makeReadableStream([c1, c2]);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(2);
  });

  it('skips non-object chunks', async () => {
    // A string that parses to a non-object (number)
    const response = makeReadableStream(['42']);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(0);
  });

  it('handles split chunk across two reads', async () => {
    const full = JSON.stringify({
      ind: 1,
      obj: { type: PacketType.STOP },
    });
    const half1 = full.slice(0, 10);
    const half2 = full.slice(10);
    const response = makeReadableStream([half1, half2]);
    const allPackets = [];
    for await (const packets of handleStream(response)) {
      allPackets.push(...packets);
    }
    expect(allPackets).toHaveLength(1);
    expect(allPackets[0].obj.type).toBe(PacketType.STOP);
  });
});

// ── createChatSession ──────────────────────────────────────────────────

describe('createChatSession', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns chat session id on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ chat_session_id: 'abc-123' }),
    });

    const result = await createChatSession(1, 'Test session');
    expect(result).toBe('abc-123');
    expect(global.fetch).toHaveBeenCalledWith(
      '/_da/chat/create-chat-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ persona_id: 1, description: 'Test session' }),
      }),
    );
  });

  it('throws on failed response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await expect(createChatSession(1)).rejects.toThrow(
      'Failed to create chat session',
    );
  });
});

// ── submitFeedback ─────────────────────────────────────────────────────

describe('submitFeedback', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends positive feedback', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await submitFeedback({
      chatMessageId: 1,
      isPositive: true,
      feedbackText: 'Great!',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.is_positive).toBe(true);
    expect(body.chat_message_id).toBe(1);
    expect(body.predefined_feedback).toBeUndefined();
  });

  it('sends negative feedback with predefined reason', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await submitFeedback({
      chatMessageId: 2,
      isPositive: false,
      predefinedFeedback: 'Inaccurate',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.is_positive).toBe(false);
    expect(body.predefined_feedback).toBe('Inaccurate');
  });

  it('throws on failed response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await expect(
      submitFeedback({ chatMessageId: 1, isPositive: true }),
    ).rejects.toThrow('Failed to submit feedback');
  });
});

// ── sendMessage ──────────────────────────────────────────────────────

describe('sendMessage', () => {
  const { sendMessage } = require('../services/streamingService');

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeStreamResponse(chunks) {
    let index = 0;
    return {
      ok: true,
      body: {
        getReader() {
          return {
            async read() {
              if (index >= chunks.length) {
                return { done: true, value: undefined };
              }
              const value = new TextEncoder().encode(chunks[index++]);
              return { done: false, value };
            },
          };
        },
      },
    };
  }

  it('sends message and yields packets', async () => {
    const chunk = JSON.stringify({
      ind: 1,
      obj: { type: 'message_delta', content: 'hello' },
    });
    global.fetch.mockResolvedValue(makeStreamResponse([chunk]));

    const allPackets = [];
    for await (const packets of sendMessage({
      message: 'test',
      chatSessionId: 'session-1',
      parentMessageId: null,
      regenerate: false,
      filters: null,
      selectedDocumentIds: [],
    })) {
      allPackets.push(...packets);
    }

    expect(allPackets).toHaveLength(1);
    expect(allPackets[0].obj.content).toBe('hello');
    expect(global.fetch).toHaveBeenCalledWith(
      '/_da/chat/send-message',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses _rq middleware for related questions', async () => {
    const chunk = JSON.stringify({
      ind: 1,
      obj: { type: 'stop' },
    });
    global.fetch.mockResolvedValue(makeStreamResponse([chunk]));

    const allPackets = [];
    for await (const packets of sendMessage(
      {
        message: 'test',
        chatSessionId: 'session-1',
        parentMessageId: null,
        regenerate: false,
        filters: null,
        selectedDocumentIds: [],
      },
      true,
    )) {
      allPackets.push(...packets);
    }

    expect(global.fetch).toHaveBeenCalledWith(
      '/_rq/chat/send-message',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on failed response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });

    const gen = sendMessage({
      message: 'test',
      chatSessionId: 'session-1',
      parentMessageId: null,
      regenerate: false,
      filters: null,
      selectedDocumentIds: [],
    });

    await expect(gen.next()).rejects.toThrow('Failed to send message');
  });

  it('includes selectedDocumentIds in payload when provided', async () => {
    const chunk = JSON.stringify({
      ind: 1,
      obj: { type: 'stop' },
    });
    global.fetch.mockResolvedValue(makeStreamResponse([chunk]));

    // eslint-disable-next-line no-unused-vars
    for await (const _ of sendMessage({
      message: 'test',
      chatSessionId: 'session-1',
      parentMessageId: null,
      regenerate: false,
      filters: null,
      selectedDocumentIds: ['doc1', 'doc2'],
    })) {
      // consume
    }

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.search_doc_ids).toEqual(['doc1', 'doc2']);
  });

  it('includes LLM override when temperature is set', async () => {
    const chunk = JSON.stringify({
      ind: 1,
      obj: { type: 'stop' },
    });
    global.fetch.mockResolvedValue(makeStreamResponse([chunk]));

    // eslint-disable-next-line no-unused-vars
    for await (const _ of sendMessage({
      message: 'test',
      chatSessionId: 'session-1',
      parentMessageId: null,
      regenerate: false,
      filters: null,
      selectedDocumentIds: [],
      temperature: 0.7,
      modelVersion: 'gpt-4',
    })) {
      // consume
    }

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.llm_override).toEqual(
      expect.objectContaining({
        temperature: 0.7,
        model_version: 'gpt-4',
      }),
    );
  });
});

// ── regenerateMessage ──────────────────────────────────────────────────

describe('regenerateMessage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends regenerate request', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    await regenerateMessage(1, 2);

    expect(global.fetch).toHaveBeenCalledWith(
      '/_da/chat/regenerate-message',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message_id: 1, chat_session_id: 2 }),
      }),
    );
  });

  it('throws on failed response', async () => {
    global.fetch.mockResolvedValue({ ok: false });
    await expect(regenerateMessage(1, 2)).rejects.toThrow(
      'Failed to regenerate message',
    );
  });
});
