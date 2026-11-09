import type {
  Message,
  Persona,
  ToolSnapshot,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from './useDeepCompareMemoize';
import { useChatStreaming } from './useChatStreaming';
import {
  createChatSession,
  sendMessage,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import { ResearchType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

interface UseChatControllerProps {
  personaId: number;
  persona?: Persona;
  enableQgen?: boolean;
  qgenAsistantId?: number;
  deepResearch?: string;
  onyxVersion?: '2' | '3';
  defaultEnabledToolIds?: (number | string)[];
  allowedToolIds?: (number | string)[];
}

interface RelatedQuestion {
  question: string;
}

// Extract JSON array from related questions response
function extractRelatedQuestions(str: string): RelatedQuestion[] {
  if (!str || str.toLowerCase().includes('no_response')) {
    return [];
  }

  // Try to parse as JSON first if it looks like JSON
  const trimmed = str.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.questions || [];
      if (Array.isArray(items)) {
        return items
          .map((item) => {
            if (typeof item === 'string') return { question: item };
            if (item && typeof item === 'object' && item.question)
              return { question: item.question };
            return null;
          })
          .filter((i): i is RelatedQuestion => i !== null);
      }
    } catch (e) {
      // Fallback to line parsing
    }
  }

  // Fallback: split by lines and clean up common list formats
  return str
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Remove leading numbers or bullets like "1. ", "- ", "* ", etc.
      const cleaned = line.replace(/^[\d\.\-\*\s]+/, '').trim();
      return cleaned ? { question: cleaned } : null;
    })
    .filter((i): i is RelatedQuestion => i !== null);
}

// Fetch related questions using the qgen assistant
async function fetchRelatedQuestions(
  query: string,
  answer: string,
  qgenAsistantId: number,
  onyxVersion: '2' | '3' = '3',
): Promise<RelatedQuestion[]> {
  try {
    console.log(
      `[RQ] Creating session for assistant ${qgenAsistantId} (Onyx v${onyxVersion})`,
    );
    const chatSessionId = await createChatSession(
      qgenAsistantId,
      `Q: ${query}`,
      true,
    );
    console.log(`[RQ] Session created: ${chatSessionId}`);

    const params = {
      message: `Question: ${query}\nAnswer:\n${answer}`,
      alternateAssistantId: qgenAsistantId,
      fileDescriptors: [],
      parentMessageId: null,
      chatSessionId,
      filters: null,
      selectedDocumentIds: [],
      use_agentic_search: false,
      regenerate: false,
      onyxVersion,
    };

    if (onyxVersion === '3') {
      console.log('[Onyx v3] Sending RQ prompt:', params.message);
    }

    let result = '';
    for await (const packets of sendMessage(params, true)) {
      for (const packet of packets) {
        if (onyxVersion === '3') {
          // console.log('[Onyx v3] RQ Packet:', packet);
        }
        if (
          packet.obj.type === PacketType.MESSAGE_DELTA ||
          packet.obj.type === PacketType.MESSAGE_START
        ) {
          result += (packet.obj as any).content || '';
        }
      }
    }
    console.log(`[RQ] Final response string: "${result}"`);
    const extracted = extractRelatedQuestions(result);
    console.log(`[RQ] Extracted ${extracted.length} questions`);
    return extracted;
  } catch (error) {
    console.error('Error fetching related questions:', error);
    return [];
  }
}

export function useChatController({
  personaId,
  persona,
  enableQgen = false,
  qgenAsistantId,
  deepResearch,
  onyxVersion = '3',
  defaultEnabledToolIds,
  allowedToolIds,
}: UseChatControllerProps) {
  const memoizedAllowedToolIds = useDeepCompareMemoize(allowedToolIds);
  const memoizedDefaultEnabledToolIds = useDeepCompareMemoize(
    defaultEnabledToolIds,
  );

  const isSearchTool = useCallback(
    (
      t:
        | ToolSnapshot
        | { name?: string; in_code_tool_id?: string; id?: number },
    ) =>
      t.in_code_tool_id === 'SearchTool' ||
      t.name === 'internal_search' ||
      t.id === 1,
    [],
  );

  const availableTools: ToolSnapshot[] = useMemo(() => {
    const rawTools = persona?.tools || [];
    return rawTools.filter((t) => {
      if (t.chat_selectable === false) return false;
      if (t.enabled === false) return false;
      if (memoizedAllowedToolIds && memoizedAllowedToolIds.length > 0) {
        return memoizedAllowedToolIds.some((id) => String(id) === String(t.id));
      }
      return true;
    });
  }, [persona?.tools, memoizedAllowedToolIds]);

  const searchTool = useMemo(
    () => availableTools.find(isSearchTool),
    [availableTools, isSearchTool],
  );

  const searchToolId = searchTool ? searchTool.id : 1;

  const initialToolIds = useMemo(() => {
    if (
      memoizedDefaultEnabledToolIds &&
      memoizedDefaultEnabledToolIds.length > 0
    ) {
      const mapped = memoizedDefaultEnabledToolIds.map((id) => Number(id));
      const matched = mapped.filter((id) =>
        availableTools.some((t) => t.id === id),
      );
      if (matched.length > 0) {
        return searchTool && !matched.includes(searchTool.id)
          ? [searchTool.id, ...matched]
          : matched;
      }
    }
    const defaultEnabled = availableTools
      .filter((t) => t.default_enabled)
      .map((t) => t.id);
    if (defaultEnabled.length > 0) {
      return searchTool && !defaultEnabled.includes(searchTool.id)
        ? [searchTool.id, ...defaultEnabled]
        : defaultEnabled;
    }
    // Default to the primary internal search tool so standard queries work out
    // of the box, but keep specialized tools (Code Interpreter, Image Generation,
    // Coding Agent, MCP connectors) disabled by default so they can be enabled
    // on demand or suggested when relevant questions are typed.
    const searchTools = availableTools
      .filter(
        (t) =>
          t.in_code_tool_id === 'SearchTool' ||
          t.name === 'internal_search' ||
          t.id === 1,
      )
      .map((t) => t.id);
    if (searchTools.length > 0) {
      return searchTools;
    }
    return [];
  }, [availableTools, memoizedDefaultEnabledToolIds, searchTool]);

  const [selectedToolIds, setSelectedToolIds] =
    useState<number[]>(initialToolIds);
  const [forcedToolId, setForcedToolId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedToolIds((prev) => {
      if (prev.length === 0 && initialToolIds.length > 0) {
        return initialToolIds;
      }
      const filtered = prev.filter((id) =>
        availableTools.some((t) => t.id === id),
      );
      const next = filtered.length > 0 ? filtered : initialToolIds;
      if (
        prev.length === next.length &&
        prev.every((val, idx) => val === next[idx])
      ) {
        return prev;
      }
      return next;
    });
  }, [initialToolIds, availableTools]);

  const toggleTool = useCallback(
    (toolId: number) => {
      // Internal search is untoggleable: always keep it active
      if (searchTool && toolId === searchTool.id) return;
      setSelectedToolIds((prev) =>
        prev.includes(toolId)
          ? prev.filter((id) => id !== toolId)
          : [...prev, toolId],
      );
    },
    [searchTool],
  );

  const enableTool = useCallback((toolId: number) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId) ? prev : [...prev, toolId],
    );
  }, []);

  const disableTool = useCallback(
    (toolId: number) => {
      // Internal search is untoggleable: cannot be disabled
      if (searchTool && toolId === searchTool.id) return;
      setSelectedToolIds((prev) => prev.filter((id) => id !== toolId));
    },
    [searchTool],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [sharedParentSessionId, setSharedParentSessionId] = useState<
    string | null
  >(null);
  const [chatSessionLoading, setChatSessionLoading] = useState(false);
  const [isDeepResearchEnabled, setIsDeepResearchEnabled] = useState(
    deepResearch === 'always_on' || deepResearch === 'user_on',
  );
  const [isFetchingRelatedQuestions, setIsFetchingRelatedQuestions] =
    useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  const messagesRef = useRef(messages);
  const nodeIdCounter = useRef(1);
  const isCancelledRef = useRef(isCancelled);
  const inheritedContextRef = useRef<string | null>(null);
  const forkedSessionMessageIdsRef = useRef<Set<number>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    isCancelledRef.current = isCancelled;
  }, [isCancelled]);

  const { isStreaming, startStreaming, cancelStreaming } = useChatStreaming({
    onMessageUpdate: (message) => {
      forkedSessionMessageIdsRef.current.add(message.nodeId);
      setMessages((prev) => {
        const existingIndex = prev.findIndex(
          (m) => m.nodeId === message.nodeId,
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...message };
          return updated;
        }
        messagesRef.current = [...prev, message];
        return messagesRef.current;
      });
    },
    onComplete: (completedMessage, processor) => {
      // Get real database IDs from backend
      const { userMessageId, assistantMessageId } = processor.messageIds;

      // Update messages with real IDs
      if (userMessageId || assistantMessageId) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) => {
            // Update user message with real ID
            if (
              userMessageId &&
              msg.type === 'user' &&
              msg.nodeId === completedMessage.parentNodeId
            ) {
              return { ...msg, messageId: userMessageId };
            }

            // Update assistant message with real ID
            if (
              assistantMessageId &&
              msg.type === 'assistant' &&
              msg.nodeId === completedMessage.nodeId
            ) {
              return { ...msg, messageId: assistantMessageId };
            }

            return msg;
          });
          messagesRef.current = updatedMessages;
          return updatedMessages;
        });
      }
    },
    onError: (error) => {
      const errorMessage: Message = {
        messageId: Date.now(),
        nodeId: nodeIdCounter.current++,
        message: '',
        error: `Error: ${error.message}`,
        type: 'error',
        parentNodeId:
          messages.length > 0 ? messages[messages.length - 1].nodeId : null,
        packets: [],
        groupedPackets: [],
        toolPackets: [],
        displayPackets: [],
        files: [],
        toolCall: null,
      };

      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const onSubmit = useCallback(
    async ({
      message,
      enabledToolIds: customToolIds,
      forcedToolId: customForcedId,
    }: {
      message?: string;
      enabledToolIds?: number[];
      forcedToolId?: number | null;
    } = {}) => {
      const messageText = message?.trim();
      if (!messageText || isStreaming || chatSessionLoading) return;

      try {
        // Create session if needed or fork from shared parent session
        let sessionId = chatSessionId;
        let additionalContext: string | null = null;
        let parentNodeId: number | null = null;
        let parentMessageId: number | null = null;

        if (sharedParentSessionId) {
          setChatSessionLoading(true);
          const parentId = sharedParentSessionId;
          const preview =
            messageText.slice(0, 40).trim() || 'Continued conversation';
          const title = `${preview} [parent:${parentId}]`;
          sessionId = await createChatSession(personaId, title);
          setChatSessionId(sessionId);
          setSharedParentSessionId(null);

          const priorTranscript = messages
            .filter((m) => m.type === 'user' || m.type === 'assistant')
            .map(
              (m) =>
                `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.message}`,
            )
            .join('\n\n');
          inheritedContextRef.current = priorTranscript || null;
          additionalContext = inheritedContextRef.current;
          parentMessageId = null;
        } else if (!sessionId) {
          setChatSessionLoading(true);
          sessionId = await createChatSession(personaId, 'Chat session');
          setChatSessionId(sessionId);
        } else {
          // Retain inherited parent context across subsequent turns
          additionalContext = inheritedContextRef.current;

          // For new messages on active session, set parent to the last assistant message
          const lastMessage = messages
            .filter((m) => m.type === 'assistant')
            .pop();

          const lastPacket =
            lastMessage?.packets?.[lastMessage.packets.length - 1];

          if (lastMessage && lastPacket?.obj?.type !== PacketType.ERROR) {
            parentNodeId = lastMessage.nodeId;
            // Only send parentMessageId if this assistant message belongs to the current session
            if (
              !inheritedContextRef.current ||
              forkedSessionMessageIdsRef.current.has(lastMessage.nodeId)
            ) {
              parentMessageId = lastMessage.messageId || null;
            } else {
              parentMessageId = null;
            }
          }
        }

        // Add user message
        const userNodeId = nodeIdCounter.current++;
        forkedSessionMessageIdsRef.current.add(userNodeId);
        const userMessage: Message = {
          messageId: Date.now(),
          nodeId: userNodeId,
          message: messageText,
          type: 'user',
          parentNodeId,
          packets: [],
          time_sent: new Date().toISOString(),
          files: [],
          toolCall: null,
          researchType: isDeepResearchEnabled
            ? ResearchType.Deep
            : ResearchType.Fast,
        };

        setMessages((prev) => [...prev, userMessage]);

        const effectiveToolIds =
          customToolIds !== undefined ? customToolIds : selectedToolIds;
        const effectiveForcedId =
          customForcedId !== undefined ? customForcedId : forcedToolId;

        // Start streaming assistant response
        const assistantNodeId = nodeIdCounter.current++;
        await startStreaming(
          {
            message: messageText,
            chatSessionId: sessionId,
            parentMessageId: parentMessageId || null,
            useAgentSearch: isDeepResearchEnabled,
            regenerate: false,
            filters: null,
            selectedDocumentIds: [],
            onyxVersion,
            enabledToolIds: effectiveToolIds,
            forcedToolIds:
              effectiveForcedId != null ? [effectiveForcedId] : undefined,
            additionalContext,
          },
          assistantNodeId,
          userNodeId,
        );
      } catch (error) {
        console.error('Failed to submit message:', error);
      } finally {
        setChatSessionLoading(false);
      }
    },
    [
      chatSessionId,
      sharedParentSessionId,
      chatSessionLoading,
      personaId,
      isStreaming,
      isDeepResearchEnabled,
      startStreaming,
      messages,
      selectedToolIds,
      forcedToolId,
      onyxVersion,
    ],
  );

  const onFetchRelatedQuestions = useCallback(async () => {
    console.log('[RQ] onFetchRelatedQuestions triggered');
    const latestAssistantMessage = messages
      .filter((m) => m.type === 'assistant')
      .pop();

    if (
      enableQgen &&
      qgenAsistantId &&
      latestAssistantMessage?.type === 'assistant'
    ) {
      console.log(
        `[RQ] Criteria met: assistantNodeId=${latestAssistantMessage.nodeId}, qgenAssistant=${qgenAsistantId}`,
      );
      if (isDeepResearchEnabled) {
        setMessages((prev) => {
          return prev.map((m) =>
            m.nodeId === latestAssistantMessage.nodeId
              ? { ...m, relatedQuestions: null }
              : m,
          );
        });
        return;
      }

      let relatedQuestions: RelatedQuestion[] | null = null;
      setIsFetchingRelatedQuestions(true);

      try {
        // Get the parent user message directly from the latest assistant message
        const userMessage = messages.find(
          (m) => m.nodeId === latestAssistantMessage.parentNodeId,
        );

        if (userMessage && latestAssistantMessage.message) {
          relatedQuestions = await fetchRelatedQuestions(
            userMessage.message,
            latestAssistantMessage.message,
            qgenAsistantId,
            onyxVersion,
          );
        }
      } catch (error) {
        console.error('Failed to fetch related questions:', error);
      } finally {
        setMessages((prev) => {
          return prev.map((m) =>
            m.nodeId === latestAssistantMessage.nodeId
              ? { ...m, relatedQuestions }
              : m,
          );
        });
        setIsFetchingRelatedQuestions(false);
      }
    }
  }, [
    messages,
    enableQgen,
    qgenAsistantId,
    isDeepResearchEnabled,
    onyxVersion,
  ]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setChatSessionId(null);
    setSharedParentSessionId(null);
    inheritedContextRef.current = null;
    forkedSessionMessageIdsRef.current.clear();
    nodeIdCounter.current = 1;
    setIsCancelled(false);
  }, []);

  const resetChatSessionId = useCallback(() => {
    setChatSessionId(null);
    setSharedParentSessionId(null);
    inheritedContextRef.current = null;
    forkedSessionMessageIdsRef.current.clear();
  }, []);

  const loadChatSession = useCallback(
    (
      sessionId: string,
      loadedMessages: Message[],
      isShared: boolean = true,
    ) => {
      setChatSessionId(sessionId);
      if (isShared) {
        setSharedParentSessionId(sessionId);
      } else {
        setSharedParentSessionId(null);
      }
      inheritedContextRef.current = null;
      forkedSessionMessageIdsRef.current.clear();
      setMessages(loadedMessages);
      messagesRef.current = loadedMessages;
      const maxId = loadedMessages.reduce(
        (max, m) => Math.max(max, m.nodeId || 0),
        0,
      );
      nodeIdCounter.current = maxId + 1;
    },
    [],
  );

  const handleCancel = useCallback(() => {
    setIsCancelled(true);
    cancelStreaming();
  }, [cancelStreaming]);

  return {
    messages,
    isStreaming: isStreaming || chatSessionLoading,
    isCancelled,
    isFetchingRelatedQuestions,
    onSubmit,
    onFetchRelatedQuestions,
    clearChat,
    resetChatSessionId,
    loadChatSession,
    cancelStreaming: handleCancel,
    isDeepResearchEnabled,
    setIsDeepResearchEnabled,
    chatSessionId,
    selectedToolIds,
    setSelectedToolIds,
    forcedToolId,
    setForcedToolId,
    toggleTool,
    enableTool,
    disableTool,
    availableTools,
    searchToolId,
    sharedParentSessionId,
  };
}
