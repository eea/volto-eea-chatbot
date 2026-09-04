import type { Message } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useChatStreaming } from './useChatStreaming';
import {
  createChatSession,
  sendMessage,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/streamingService';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import { ResearchType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

interface UseChatControllerProps {
  personaId: number;
  enableQgen?: boolean;
  qgenAsistantId?: number;
  deepResearch?: string;
  onyxVersion?: '2' | '3';
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
  onyxVersion: '2' | '3' = '2',
): Promise<RelatedQuestion[]> {
  try {
    console.log(`[RQ] Creating session for assistant ${qgenAsistantId} (Onyx v${onyxVersion})`);
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
  enableQgen = false,
  qgenAsistantId,
  deepResearch,
  onyxVersion = '2',
}: UseChatControllerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
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

  // Keep ref in sync with state
  useEffect(() => {
    isCancelledRef.current = isCancelled;
  }, [isCancelled]);

  const { isStreaming, startStreaming, cancelStreaming } = useChatStreaming({
    onMessageUpdate: (message) => {
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
    async ({ message }: { message?: string }) => {
      if (isStreaming) return;

      try {
        // Create session if needed
        let sessionId = chatSessionId;

        if (!sessionId) {
          setChatSessionLoading(true);
          sessionId = await createChatSession(personaId, 'Chat session');
          setChatSessionId(sessionId);
        }

        let messageText = message;
        let parentNodeId: number | null = null;
        let parentMessageId: number | null = null;

        // For new messages, set parent to the last assistant message
        const lastMessage = messages
          .filter((m) => m.type === 'assistant')
          .pop();

        const lastPacket = lastMessage?.packets.pop();

        if (lastMessage && lastPacket?.obj.type !== PacketType.ERROR) {
          parentNodeId = lastMessage.nodeId;
          parentMessageId = lastMessage.messageId || null;
        }

        if (!messageText?.trim()) return;

        // Add user message
        const userNodeId = nodeIdCounter.current++;
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
      personaId,
      isStreaming,
      isDeepResearchEnabled,
      startStreaming,
      messages,
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
      console.log(`[RQ] Criteria met: assistantNodeId=${latestAssistantMessage.nodeId}, qgenAssistant=${qgenAsistantId}`);
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
  }, [messages, enableQgen, qgenAsistantId, isDeepResearchEnabled, onyxVersion]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setChatSessionId(null);
    nodeIdCounter.current = 1;
    setIsCancelled(false);
  }, []);

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
    cancelStreaming: handleCancel,
    isDeepResearchEnabled,
    setIsDeepResearchEnabled,
    chatSessionId,
  };
}
