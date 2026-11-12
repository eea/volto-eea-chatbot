import type {
  Message,
  OnyxDocument,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import {
  PacketType,
  type Packet,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';

export interface RawChatMessageDetail {
  message_id: number;
  parent_message?: number | null;
  latest_child_message?: number | null;
  message: string;
  message_type: 'user' | 'assistant' | 'system';
  context_docs?:
    | {
        top_documents?: any[];
        [key: string]: any;
      }
    | any[];
  citations?: Record<string | number, string>;
  time_sent?: string;
  files?: any[];
}

export interface SharedChatSessionResponse {
  chat_session_id: string;
  description?: string | null;
  persona_id?: number | null;
  persona_name?: string | null;
  messages: RawChatMessageDetail[];
}

/**
 * Fetch a shared chat session by UUID.
 * Upstream middleware enforces `is_shared=true` and checks `shared_status === 'public'`.
 */
export async function getSharedChatSession(
  chatSessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SharedChatSessionResponse> {
  const url = `/_da/chat/get-chat-session/${encodeURIComponent(chatSessionId)}`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load shared conversation (${response.status} ${response.statusText})`,
    );
  }

  return await response.json();
}

/**
 * Reconstruct a raw Onyx ChatSessionDetail into volto-eea-chatbot `Message[]` models.
 * Synthesizes completed display packets for assistant messages so that markdown,
 * citations, and sources render with identical fidelity to live chat.
 */
export function deserializeChatSession(
  sessionDetail: SharedChatSessionResponse,
): Message[] {
  if (!sessionDetail || !Array.isArray(sessionDetail.messages)) {
    return [];
  }

  // Filter out system messages (only show user and assistant messages)
  const visibleMessages = sessionDetail.messages.filter(
    (msg) => msg.message_type === 'user' || msg.message_type === 'assistant',
  );

  return visibleMessages.map((msg, index) => {
    const isUser = msg.message_type === 'user';
    const nodeId = msg.message_id || index + 1;

    if (isUser) {
      return {
        messageId: msg.message_id,
        nodeId,
        parentNodeId: msg.parent_message ?? null,
        latestChildNodeId: msg.latest_child_message ?? null,
        type: 'user',
        message: msg.message || '',
        files: msg.files || [],
        toolCall: null,
        packets: [],
        isComplete: true,
        time_sent: msg.time_sent,
      };
    }

    // Assistant message: extract context docs and citations
    const rawDocs = Array.isArray(msg.context_docs)
      ? msg.context_docs
      : msg.context_docs?.top_documents || [];

    const documents: OnyxDocument[] = rawDocs.map((doc: any) => ({
      document_id: doc.document_id,
      semantic_identifier: doc.semantic_identifier || '',
      link: doc.link || null,
      blurb: doc.blurb || '',
      source_type: doc.source_type || 'web',
      updated_at: doc.updated_at || null,
      match_highlights: doc.match_highlights || [],
      db_doc_id: doc.db_doc_id,
      score: doc.score,
    }));

    const citations: Record<string, string> = {};
    if (msg.citations && typeof msg.citations === 'object') {
      Object.entries(msg.citations).forEach(([k, v]) => {
        citations[String(k)] = String(v);
      });
    }

    // Synthesize display packets that satisfy `isFinalAnswerComplete`
    const packets: Packet[] = [
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_START,
          content: '',
        },
      },
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_DELTA,
          content: msg.message || '',
        },
      },
      {
        ind: 0,
        obj: {
          type: PacketType.SECTION_END,
        },
      },
      {
        ind: 0,
        obj: {
          type: PacketType.STOP,
        },
      },
    ];

    return {
      messageId: msg.message_id,
      nodeId,
      parentNodeId: msg.parent_message ?? null,
      latestChildNodeId: msg.latest_child_message ?? null,
      type: 'assistant',
      message: msg.message || '',
      files: msg.files || [],
      toolCall: null,
      packets,
      groupedPackets: [{ ind: 0, packets }],
      displayPackets: [0],
      toolPackets: [],
      isComplete: true,
      documents,
      citations,
      time_sent: msg.time_sent,
    };
  });
}

/**
 * Builds the canonical shareable secret link for a conversation.
 */
export function getShareableLink(
  chatSessionId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
  pathname: string = typeof window !== 'undefined'
    ? window.location.pathname
    : '',
): string {
  const base = `${origin}${pathname}`;
  return `${base}?chat=${encodeURIComponent(chatSessionId)}`;
}

/**
 * Promotes a chat session to 'public' in Onyx via the backend middleware share endpoint.
 */
export async function shareChatSession(
  chatSessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!chatSessionId) return false;
  try {
    const url = `/_da/chat/share-chat-session/${encodeURIComponent(chatSessionId)}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to share chat session:', err);
    return false;
  }
}

/**
 * Copy shareable link to the user's clipboard with fallback support,
 * and updates the browser address bar to reflect the shared session URL.
 */
export async function copyShareLink(chatSessionId: string): Promise<boolean> {
  const shareUrl = getShareableLink(chatSessionId);

  // Update browser address bar to reflect the shared session URL
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('chat', chatSessionId);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Ignore URL update errors in non-browser/restricted environments
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      // Fallback to DOM execCommand below
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}
