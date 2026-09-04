import { renderHook, act } from '@testing-library/react-hooks';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';

import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useChatController';
import { createChatSession } from '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService';

// Mock the streaming service with configurable sendMessage behavior
const mockSendMessage = vi.fn(async function* () {
  yield [];
});

vi.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService',
  () => ({
    sendMessage: (...args) => mockSendMessage(...args),
    createChatSession: vi.fn().mockResolvedValue('session-123'),
  }),
);

describe('useChatController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockSendMessage.mockImplementation(async function* () {
      yield [];
    });
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isCancelled).toBe(false);
    expect(typeof result.current.onSubmit).toBe('function');
    expect(typeof result.current.clearChat).toBe('function');
    expect(typeof result.current.cancelStreaming).toBe('function');
  });

  it('initializes deep research based on config', () => {
    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'always_on' }),
    );

    expect(result.current.isDeepResearchEnabled).toBe(true);
  });

  it('initializes deep research as false when not configured', () => {
    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'disabled' }),
    );

    expect(result.current.isDeepResearchEnabled).toBe(false);
  });

  it('initializes deep research with user_on', () => {
    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'user_on' }),
    );

    expect(result.current.isDeepResearchEnabled).toBe(true);
  });

  it('creates a chat session on first submit', async () => {
    createChatSession.mockResolvedValue('session-123');

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    expect(createChatSession).toHaveBeenCalledWith(1, 'Chat session');
    expect(result.current.messages.length).toBeGreaterThan(0);
    // First message should be a user message
    expect(result.current.messages[0].type).toBe('user');
    expect(result.current.messages[0].message).toBe('Hello');
  });

  it('does not submit empty messages', async () => {
    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: '   ' });
    });

    // Should only have session creation but no messages since message is blank
    expect(result.current.messages).toEqual([]);
  });

  it('clearChat resets all state', async () => {
    createChatSession.mockResolvedValue('session-123');

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.chatSessionId).toBeNull();
  });

  it('cancelStreaming sets isCancelled to true', () => {
    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    act(() => {
      result.current.cancelStreaming();
    });

    expect(result.current.isCancelled).toBe(true);
  });

  it('setIsDeepResearchEnabled toggles deep research', () => {
    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'user_off' }),
    );

    expect(result.current.isDeepResearchEnabled).toBe(false);

    act(() => {
      result.current.setIsDeepResearchEnabled(true);
    });

    expect(result.current.isDeepResearchEnabled).toBe(true);
  });

  it('handles session creation error gracefully', async () => {
    createChatSession.mockRejectedValue(new Error('Session creation failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reuses existing session on subsequent submits', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
      yield [
        {
          ind: 1,
          obj: {
            type: PacketType.MESSAGE_START,
            id: 'msg1',
            content: 'Reply',
            final_documents: null,
          },
        },
        { ind: 2, obj: { type: PacketType.STOP } },
      ];
    });

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: 'First' });
    });

    createChatSession.mockClear();

    await act(async () => {
      await result.current.onSubmit({ message: 'Second' });
    });

    // Should not create a new session
    expect(createChatSession).not.toHaveBeenCalled();
  });

  it('adds user message with deep research type when enabled', async () => {
    createChatSession.mockResolvedValue('session-123');

    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'always_on' }),
    );

    await act(async () => {
      await result.current.onSubmit({ message: 'Search deeply' });
    });

    const userMsg = result.current.messages.find((m) => m.type === 'user');
    expect(userMsg.researchType).toBe('DEEP');
  });

  it('adds user message with fast research type when deep research is disabled', async () => {
    createChatSession.mockResolvedValue('session-123');

    const { result } = renderHook(() =>
      useChatController({ personaId: 1, deepResearch: 'disabled' }),
    );

    await act(async () => {
      await result.current.onSubmit({ message: 'Quick search' });
    });

    const userMsg = result.current.messages.find((m) => m.type === 'user');
    expect(userMsg.researchType).toBe('FAST');
  });

  it('exposes onFetchRelatedQuestions callback', () => {
    const { result } = renderHook(() =>
      useChatController({ personaId: 1, enableQgen: true, qgenAsistantId: 2 }),
    );

    expect(typeof result.current.onFetchRelatedQuestions).toBe('function');
  });

  it('onFetchRelatedQuestions sets null relatedQuestions when deep research is on', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
      yield [
        {
          ind: 1,
          obj: {
            type: PacketType.MESSAGE_START,
            id: 'msg1',
            content: 'Answer',
            final_documents: null,
          },
        },
        { ind: 2, obj: { type: PacketType.STOP } },
      ];
    });

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        enableQgen: true,
        qgenAsistantId: 2,
        deepResearch: 'always_on',
      }),
    );

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    await act(async () => {
      await result.current.onFetchRelatedQuestions();
    });

    // When deep research is on, relatedQuestions should be set to null
    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    if (assistantMsg) {
      expect(assistantMsg.relatedQuestions).toBeNull();
    }
  });

  it('exposes isFetchingRelatedQuestions state', () => {
    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    expect(result.current.isFetchingRelatedQuestions).toBe(false);
  });

  it('updates messageIds on MESSAGE_END_ID_INFO in streaming response', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
      yield [
        {
          ind: 0,
          obj: {
            type: PacketType.MESSAGE_START,
            id: 'msg1',
            content: 'Hello',
            final_documents: null,
          },
        },
        {
          ind: -1,
          obj: {
            type: PacketType.MESSAGE_END_ID_INFO,
            user_message_id: 101,
            reserved_assistant_message_id: 202,
          },
        },
        { ind: 1, obj: { type: PacketType.STOP } },
      ];
    });

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    await act(async () => {
      await result.current.onSubmit({ message: 'First' });
    });

    const userMsg = result.current.messages.find((m) => m.type === 'user');
    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );

    expect(userMsg.messageId).toBe(101);
    expect(assistantMsg.messageId).toBe(202);
  });

  it('adds an error message on streaming failure', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
      if (false) yield;
      throw new Error('Streaming failed unexpectedly');
    });

    const { result } = renderHook(() => useChatController({ personaId: 1 }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      await result.current.onSubmit({ message: 'Trigger error' });
    });

    expect(result.current.messages.length).toBeGreaterThan(0);
    const errorMsg = result.current.messages.find((m) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg.error).toContain('Streaming failed unexpectedly');

    consoleSpy.mockRestore();
  });

  it('successfully fetches related questions when enableQgen is true', async () => {
    createChatSession.mockResolvedValue('session-123');

    let callCount = 0;
    mockSendMessage.mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield [
          {
            ind: 0,
            obj: {
              type: PacketType.MESSAGE_START,
              id: 'msg1',
              content: 'This is the answer',
              final_documents: null,
            },
          },
          { ind: 1, obj: { type: PacketType.STOP } },
        ];
      } else {
        yield [
          {
            ind: 0,
            obj: {
              type: PacketType.MESSAGE_DELTA,
              content:
                '1. What is the weather like?\n2. What is climate change?\n',
            },
          },
          { ind: 1, obj: { type: PacketType.STOP } },
        ];
      }
    });

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        enableQgen: true,
        qgenAsistantId: 2,
        deepResearch: 'disabled',
      }),
    );

    // 1. Submit normal message
    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    // 2. Fetch related questions
    await act(async () => {
      await result.current.onFetchRelatedQuestions();
    });

    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    expect(assistantMsg.relatedQuestions).toEqual([
      { question: 'What is the weather like?' },
      { question: 'What is climate change?' },
    ]);
  });

  it('handles related questions fetch error gracefully', async () => {
    createChatSession.mockResolvedValue('session-123');

    let callCount = 0;
    mockSendMessage.mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield [
          {
            ind: 0,
            obj: {
              type: PacketType.MESSAGE_START,
              id: 'msg1',
              content: 'This is the answer',
              final_documents: null,
            },
          },
          { ind: 1, obj: { type: PacketType.STOP } },
        ];
      } else {
        throw new Error('Failed to fetch related questions');
      }
    });

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        enableQgen: true,
        qgenAsistantId: 2,
        deepResearch: 'disabled',
      }),
    );

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      await result.current.onFetchRelatedQuestions();
    });

    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    expect(assistantMsg.relatedQuestions).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('extracts related questions from JSON formats', async () => {
    createChatSession.mockResolvedValue('session-123');

    let callCount = 0;
    mockSendMessage.mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield [
          {
            ind: 0,
            obj: {
              type: PacketType.MESSAGE_START,
              content: 'Answer',
            },
          },
          { ind: 1, obj: { type: PacketType.STOP } },
        ];
      } else {
        yield [
          {
            ind: 0,
            obj: {
              type: PacketType.MESSAGE_DELTA,
              content: JSON.stringify(['Question A', 'Question B']),
            },
          },
          { ind: 1, obj: { type: PacketType.STOP } },
        ];
      }
    });

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        enableQgen: true,
        qgenAsistantId: 2,
      }),
    );

    await act(async () => {
      await result.current.onSubmit({ message: 'Hello' });
    });

    await act(async () => {
      await result.current.onFetchRelatedQuestions();
    });

    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    expect(assistantMsg.relatedQuestions).toEqual([
      { question: 'Question A' },
      { question: 'Question B' },
    ]);
  });
});
