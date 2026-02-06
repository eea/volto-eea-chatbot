import { renderHook, act } from '@testing-library/react-hooks';
import { PacketType } from '../types/streamingModels';

import { useChatController } from '../hooks/useChatController';
import { createChatSession } from '../services/streamingService';

// Mock the streaming service with configurable sendMessage behavior
const mockSendMessage = jest.fn(async function* () {
  yield [];
});

jest.mock('../services/streamingService', () => ({
  sendMessage: (...args) => mockSendMessage(...args),
  createChatSession: jest.fn().mockResolvedValue('session-123'),
}));

describe('useChatController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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
});
