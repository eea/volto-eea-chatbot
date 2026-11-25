import { renderHook, act } from '@testing-library/react-hooks';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';

import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useChatController';
import { createChatSession } from '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService';

// Mock the streaming service with configurable sendMessage behavior
const mockSendMessage = jest.fn(async function* () {
  yield [];
});

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService',
  () => ({
    sendMessage: (...args) => mockSendMessage(...args),
    createChatSession: jest.fn().mockResolvedValue('session-123'),
  }),
);

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

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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

    mockSendMessage.mockImplementation(async function* () {
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
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          questions: ['What is the weather like?', 'What is climate change?'],
        }),
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

    expect(global.fetch).toHaveBeenCalledWith(
      '/_rq/questions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: 2,
          query: 'Hello',
          answer: 'This is the answer',
        }),
      }),
    );

    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    expect(assistantMsg.relatedQuestions).toEqual([
      { question: 'What is the weather like?' },
      { question: 'What is climate change?' },
    ]);

    global.fetch = originalFetch;
  });

  it('handles related questions fetch error gracefully', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
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
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

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

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await act(async () => {
      await result.current.onFetchRelatedQuestions();
    });

    const assistantMsg = result.current.messages.find(
      (m) => m.type === 'assistant',
    );
    expect(assistantMsg.relatedQuestions).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('handles related questions non-ok response gracefully', async () => {
    createChatSession.mockResolvedValue('session-123');

    mockSendMessage.mockImplementation(async function* () {
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
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

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
    expect(assistantMsg.relatedQuestions).toEqual([]);
    global.fetch = originalFetch;
  });

  it('manages tool selection and passes enabledToolIds to streaming', async () => {
    createChatSession.mockResolvedValue('session-123');

    const mockPersona = {
      id: 1,
      name: 'Test Persona',
      tools: [
        {
          id: 1,
          name: 'internal_search',
          display_name: 'Search',
          chat_selectable: true,
          default_enabled: true,
        },
        {
          id: 6,
          name: 'python',
          display_name: 'Python',
          chat_selectable: true,
          default_enabled: false,
        },
        {
          id: 10,
          name: 'data_mcp',
          display_name: 'Data MCP',
          mcp_server_id: 1,
          chat_selectable: true,
        },
      ],
    };

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        persona: mockPersona,
      }),
    );

    expect(result.current.availableTools).toHaveLength(3);
    expect(result.current.selectedToolIds).toEqual([1]);

    act(() => {
      result.current.toggleTool(10);
    });
    expect(result.current.selectedToolIds).toEqual([1, 10]);

    await act(async () => {
      await result.current.onSubmit({ message: 'Run data query' });
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Run data query',
        enabledToolIds: [1, 10],
      }),
    );

    act(() => {
      result.current.disableTool(1);
    });
    // Internal search cannot be disabled (untoggleable)
    expect(result.current.selectedToolIds).toEqual([1, 10]);

    act(() => {
      result.current.toggleTool(1);
    });
    // Internal search is untoggleable
    expect(result.current.selectedToolIds).toEqual([1, 10]);

    act(() => {
      result.current.disableTool(10);
    });
    expect(result.current.selectedToolIds).toEqual([1]);

    act(() => {
      result.current.enableTool(6);
    });
    expect(result.current.selectedToolIds).toEqual([1, 6]);
  });

  it('respects allowedToolIds and defaultEnabledToolIds from block config', () => {
    const mockPersona = {
      id: 1,
      name: 'Test Persona',
      tools: [
        {
          id: 1,
          name: 'internal_search',
          display_name: 'Search',
          chat_selectable: true,
        },
        {
          id: 6,
          name: 'python',
          display_name: 'Python',
          chat_selectable: true,
        },
        {
          id: 10,
          name: 'data_mcp',
          display_name: 'Data MCP',
          mcp_server_id: 1,
          chat_selectable: true,
        },
      ],
    };

    // Pass string IDs as returned by Volto multi-select fields: ['6', '10']
    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        persona: mockPersona,
        allowedToolIds: ['6', '10'],
        defaultEnabledToolIds: ['10'],
      }),
    );

    // Only tool 6 and 10 should be exposed
    expect(result.current.availableTools.map((t) => t.id)).toEqual([6, 10]);
    // Only tool 10 should be enabled by default
    expect(result.current.selectedToolIds).toEqual([10]);
  });

  it('forks shared conversation into new linked session with additionalContext on submit', async () => {
    createChatSession.mockResolvedValue('new-session-uuid-999');

    const mockPersona = {
      id: 1,
      name: 'EEA Assistant',
      tools: [{ id: 1, name: 'internal_search', display_name: 'Search' }],
    };

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        persona: mockPersona,
      }),
    );

    const initialSharedMessages = [
      {
        messageId: 1,
        nodeId: 1,
        type: 'user',
        message: 'What is air quality?',
      },
      {
        messageId: 2,
        nodeId: 2,
        type: 'assistant',
        message: 'Air quality measures pollutants in the atmosphere.',
        packets: [],
      },
    ];

    // Load shared session
    act(() => {
      result.current.loadChatSession(
        'shared-session-uuid-111',
        initialSharedMessages,
        true,
      );
    });

    expect(result.current.chatSessionId).toBe('shared-session-uuid-111');
    expect(result.current.sharedParentSessionId).toBe(
      'shared-session-uuid-111',
    );
    expect(result.current.messages).toHaveLength(2);

    // Submit follow-up message
    await act(async () => {
      await result.current.onSubmit({ message: 'What about in Denmark?' });
    });

    // Verifies createChatSession was called with [parent:<sharedSessionId>] tag
    expect(createChatSession).toHaveBeenCalledWith(
      1,
      expect.stringContaining('[parent:shared-session-uuid-111]'),
    );

    // Chat session id updated to new session and shared parent cleared
    expect(result.current.chatSessionId).toBe('new-session-uuid-999');
    expect(result.current.sharedParentSessionId).toBeNull();

    // Verify startStreaming was called with new session and additionalContext containing prior turn
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'What about in Denmark?',
        chatSessionId: 'new-session-uuid-999',
        parentMessageId: null,
        additionalContext: expect.stringContaining(
          'User: What is air quality?\n\nAssistant: Air quality measures pollutants in the atmosphere.',
        ),
      }),
    );

    // Second follow-up turn in session B retains inheritedContext
    await act(async () => {
      await result.current.onSubmit({ message: 'And in Sweden?' });
    });

    expect(mockSendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'And in Sweden?',
        chatSessionId: 'new-session-uuid-999',
        additionalContext: expect.stringContaining(
          'User: What is air quality?\n\nAssistant: Air quality measures pollutants in the atmosphere.',
        ),
      }),
    );
  });

  it('ignores blank follow-up messages without forking shared session', async () => {
    createChatSession.mockClear();

    const { result } = renderHook(() =>
      useChatController({
        personaId: 1,
        persona: { id: 1, name: 'EEA Assistant', tools: [] },
      }),
    );

    act(() => {
      result.current.loadChatSession('shared-session-123', [], true);
    });

    await act(async () => {
      await result.current.onSubmit({ message: '   ' });
    });

    expect(createChatSession).not.toHaveBeenCalled();
    expect(result.current.chatSessionId).toBe('shared-session-123');
    expect(result.current.sharedParentSessionId).toBe('shared-session-123');
  });
  describe('assistant switching', () => {
    const searchTool = {
      id: 10,
      in_code_tool_id: 'SearchTool',
      name: 'internal_search',
    };
    const personaA = {
      id: 1,
      name: 'Assistant A',
      tools: [searchTool, { id: 20, name: 'code_interpreter' }],
    };
    const personaB = {
      id: 2,
      name: 'Assistant B',
      tools: [
        { id: 40, in_code_tool_id: 'SearchTool', name: 'internal_search' },
        { id: 30, name: 'web_search' },
      ],
    };

    const submit = async (result, message) => {
      let outcome;
      await act(async () => {
        outcome = await result.current.onSubmit({ message });
      });
      return outcome;
    };

    it('forks into a new session for the new assistant, with the conversation as context', async () => {
      createChatSession.mockResolvedValue('session-A');
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      await submit(result, 'Hello there');
      expect(createChatSession).toHaveBeenLastCalledWith(1, 'Chat session');

      createChatSession.mockClear();
      createChatSession.mockResolvedValue('session-B');
      rerender({ personaId: 2, persona: personaB });
      await submit(result, 'Follow-up question');

      expect(createChatSession).toHaveBeenCalledTimes(1);
      const [personaId, description] = createChatSession.mock.calls[0];
      expect(personaId).toBe(2);
      expect(description).toMatch(/\[parent:session-A\]$/);
      expect(result.current.chatSessionId).toBe('session-B');
      expect(mockSendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chatSessionId: 'session-B',
          additionalContext: 'User: Hello there',
          parentMessageId: null,
        }),
      );
    });

    it('creates a plain session when the assistant is chosen before the first message', async () => {
      createChatSession.mockResolvedValue('session-B');
      const { result } = renderHook(() =>
        useChatController({ personaId: 2, persona: personaB }),
      );

      await submit(result, 'First question');

      expect(createChatSession).toHaveBeenCalledWith(2, 'Chat session');
      expect(mockSendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ additionalContext: null }),
      );
    });

    it('does not fork when the visitor switches away and back without sending', async () => {
      createChatSession.mockResolvedValue('session-A');
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      await submit(result, 'Hello there');
      createChatSession.mockClear();

      rerender({ personaId: 2, persona: personaB });
      rerender({ personaId: 1, persona: personaA });
      await submit(result, 'Still here');

      expect(createChatSession).not.toHaveBeenCalled();
      expect(result.current.chatSessionId).toBe('session-A');
      expect(mockSendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ additionalContext: null }),
      );
    });

    it('truncates an over-long conversation before handing it over as context', async () => {
      createChatSession.mockResolvedValue('session-A');
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      await submit(result, 'A'.repeat(6000));
      await submit(result, 'B'.repeat(6000));

      createChatSession.mockResolvedValue('session-B');
      rerender({ personaId: 2, persona: personaB });
      await submit(result, 'And now?');

      const { additionalContext } = mockSendMessage.mock.calls.pop()[0];
      expect(
        additionalContext.startsWith('[Earlier conversation truncated]'),
      ).toBe(true);
      expect(additionalContext).toContain('B'.repeat(6000));
      expect(additionalContext).not.toContain('A'.repeat(6000));
    });

    it('keeps shared tools, drops missing ones and never enables the new assistant defaults', async () => {
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      act(() => {
        result.current.enableTool(20);
      });
      expect(result.current.selectedToolIds).toEqual([10, 20]);

      rerender({ personaId: 2, persona: personaB });

      expect(result.current.selectedToolIds).toEqual([40]);
      expect(result.current.selectedToolIds).not.toContain(30);
    });

    it('sends no tools when the new assistant has none of the active ones', async () => {
      const personaC = { id: 3, name: 'Assistant C', tools: [{ id: 30 }] };
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      act(() => {
        result.current.enableTool(20);
      });
      rerender({ personaId: 3, persona: personaC });

      expect(result.current.selectedToolIds).toEqual([]);
      expect(result.current.availableTools).toEqual([{ id: 30 }]);
    });

    it('sends only the tools both assistants share', async () => {
      createChatSession.mockResolvedValue('session-A');
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      act(() => {
        result.current.enableTool(20);
      });

      createChatSession.mockResolvedValue('session-B');
      rerender({ personaId: 2, persona: personaB });
      await submit(result, 'Follow-up');

      expect(mockSendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabledToolIds: [40] }),
      );
    });

    it('does not enable the new defaults when nothing was active before', async () => {
      const personaWithoutTools = { id: 1, name: 'Bare', tools: [] };
      const personaWithDefaults = {
        id: 2,
        name: 'Defaults',
        tools: [
          { id: 40, in_code_tool_id: 'SearchTool', name: 'internal_search' },
          { id: 30, name: 'web_search', default_enabled: true },
        ],
      };

      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaWithoutTools } },
      );

      expect(result.current.selectedToolIds).toEqual([]);

      rerender({ personaId: 2, persona: personaWithDefaults });

      expect(result.current.selectedToolIds).toEqual([40]);
    });

    it('keeps a truncated tail of an over-long single message', async () => {
      createChatSession.mockResolvedValue('session-A');
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      await submit(result, 'X'.repeat(9000));

      createChatSession.mockResolvedValue('session-B');
      rerender({ personaId: 2, persona: personaB });
      await submit(result, 'And now?');

      const { additionalContext } = mockSendMessage.mock.calls.pop()[0];
      expect(
        additionalContext.startsWith('[Earlier conversation truncated]'),
      ).toBe(true);
      expect(additionalContext.length).toBeLessThanOrEqual(8100);
      expect(additionalContext).toContain('XXXX');
    });

    it('drops a forced tool the new assistant does not have', async () => {
      const { result, rerender } = renderHook(
        ({ personaId, persona }) => useChatController({ personaId, persona }),
        { initialProps: { personaId: 1, persona: personaA } },
      );

      act(() => {
        result.current.setForcedToolId(20);
      });
      expect(result.current.forcedToolId).toBe(20);

      rerender({ personaId: 2, persona: personaB });

      expect(result.current.forcedToolId).toBeNull();
    });

    it('reports a rejected submit when the session cannot be created', async () => {
      createChatSession.mockRejectedValue(new Error('session endpoint down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useChatController({ personaId: 1, persona: personaA }),
      );

      const outcome = await submit(result, 'Will this survive?');

      expect(outcome).toEqual({ accepted: false });
      expect(result.current.messages).toEqual([]);
    });
  });
});
