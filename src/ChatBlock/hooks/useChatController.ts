import type {
  Message,
  Persona,
  ToolSnapshot,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from './useDeepCompareMemoize';
import {
  flattenTranscript,
  isTruncated,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/priorTranscript';
import { useChatStreaming } from './useChatStreaming';
import { createChatSession } from '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService';
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

// Fetch related questions using the qgen assistant
async function fetchRelatedQuestions(
  query: string,
  answer: string,
  qgenAsistantId: number,
): Promise<RelatedQuestion[]> {
  try {
    const res = await fetch('/_rq/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: qgenAsistantId,
        query,
        answer,
      }),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data?.questions)) {
      return data.questions.map((q: string) => ({ question: q }));
    }
    return [];
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

  // On a persona change, keep only the tools that were already active.
  const previousPersonaIdRef = useRef(personaId);
  useEffect(() => {
    const personaChanged =
      String(previousPersonaIdRef.current) !== String(personaId);
    previousPersonaIdRef.current = personaId;

    setSelectedToolIds((prev) => {
      const filtered = prev.filter((id) =>
        availableTools.some((t) => t.id === id),
      );

      let next: number[];
      if (personaChanged) {
        // Internal search is the only tool restored, and only when offered.
        next =
          searchTool && !filtered.includes(searchTool.id)
            ? [searchTool.id, ...filtered]
            : filtered;
      } else if (prev.length === 0 && initialToolIds.length > 0) {
        next = initialToolIds;
      } else {
        next = filtered.length > 0 ? filtered : initialToolIds;
      }

      if (
        prev.length === next.length &&
        prev.every((val, idx) => val === next[idx])
      ) {
        return prev;
      }
      return next;
    });
  }, [personaId, initialToolIds, availableTools, searchTool]);

  // A forced tool that the active assistant does not have cannot be run.
  useEffect(() => {
    setForcedToolId((prev) =>
      prev !== null && !availableTools.some((t) => t.id === prev) ? null : prev,
    );
  }, [availableTools]);

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
  // Persona the live session was created with.
  const [sessionPersonaId, setSessionPersonaId] = useState<number | null>(null);
  const [sharedParentSessionId, setSharedParentSessionId] = useState<
    string | null
  >(null);
  const [chatSessionLoading, setChatSessionLoading] = useState(false);
  // True when the conversation handed to the current session lost its start.
  const [isContextTruncated, setIsContextTruncated] = useState(false);
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
      if (!messageText || isStreaming || chatSessionLoading) {
        return { accepted: false };
      }

      let sessionId = chatSessionId;
      let additionalContext: string | null = inheritedContextRef.current;
      let parentNodeId: number | null = null;
      let parentMessageId: number | null = null;

      // One persona per session, so a continuation or a switch forks.
      const personaChanged =
        Boolean(sessionId) && String(sessionPersonaId) !== String(personaId);
      const parentSessionId =
        sharedParentSessionId || (personaChanged ? sessionId : null);

      if (parentSessionId || !sessionId) {
        setChatSessionLoading(true);
        try {
          const description = parentSessionId
            ? `${
                messageText.slice(0, 40).trim() || 'Continued conversation'
              } [parent:${parentSessionId}]`
            : 'Chat session';
          sessionId = await createChatSession(personaId, description);
        } catch (error) {
          // Nothing was appended: the composer can keep the draft.
          console.error('Failed to create chat session:', error);
          setChatSessionLoading(false);
          return { accepted: false };
        }
        setChatSessionLoading(false);
        setChatSessionId(sessionId);
        setSessionPersonaId(personaId);
        setSharedParentSessionId(null);

        if (parentSessionId) {
          inheritedContextRef.current = flattenTranscript(messages);
          additionalContext = inheritedContextRef.current;
          setIsContextTruncated(isTruncated(inheritedContextRef.current));
          parentMessageId = null;
          // Nodes from the previous session are not valid parents here.
          forkedSessionMessageIdsRef.current.clear();
        }
      } else {
        // Retain inherited parent context across subsequent turns
        additionalContext = inheritedContextRef.current;

        // Parent to the last assistant message of this session.
        const lastMessage = messages
          .filter((m) => m.type === 'assistant')
          .pop();
        const lastPacket =
          lastMessage?.packets?.[lastMessage.packets.length - 1];

        if (lastMessage && lastPacket?.obj?.type !== PacketType.ERROR) {
          parentNodeId = lastMessage.nodeId;
          // Only nodes of the session we are writing to may be its parent.
          parentMessageId = forkedSessionMessageIdsRef.current.has(
            lastMessage.nodeId,
          )
            ? lastMessage.messageId || null
            : null;
        }
      }

      try {
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
      }

      return { accepted: true };
    },
    [
      chatSessionId,
      sessionPersonaId,
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
  }, [messages, enableQgen, qgenAsistantId, isDeepResearchEnabled]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsContextTruncated(false);
    setChatSessionId(null);
    setSessionPersonaId(null);
    setSharedParentSessionId(null);
    inheritedContextRef.current = null;
    forkedSessionMessageIdsRef.current.clear();
    nodeIdCounter.current = 1;
    setIsCancelled(false);
  }, []);

  const resetChatSessionId = useCallback(() => {
    setChatSessionId(null);
    setSessionPersonaId(null);
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
      setIsContextTruncated(false);
      // Unknown until the first fork.
      setSessionPersonaId(null);
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
    isContextTruncated,
    selectedToolIds,
    setSelectedToolIds,
    sessionPersonaId,
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
