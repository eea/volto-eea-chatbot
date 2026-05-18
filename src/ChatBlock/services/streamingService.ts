import {
  PacketType,
  type Packet,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import type {
  FileDescriptor,
  Filters,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

export interface SendMessageParams {
  regenerate: boolean;
  message: string;
  fileDescriptors?: FileDescriptor[];
  parentMessageId: number | null;
  chatSessionId: string;
  filters: Filters | null;
  selectedDocumentIds: number[] | string[] | null;
  queryOverride?: string;
  forceSearch?: boolean;
  modelProvider?: string;
  modelVersion?: string;
  temperature?: number;
  systemPromptOverride?: string;
  taskPromptOverride?: string;
  useExistingUserMessage?: boolean;
  alternateAssistantId?: number;
  signal?: AbortSignal;
  currentMessageFiles?: FileDescriptor[];
  useAgentSearch?: boolean;
  enabledToolIds?: number[];
  forcedToolIds?: number[];
  retrieval_options?: any;
  onyxVersion?: '2' | '3';
}

export interface StreamResponse {
  packets: Packet[];
  error?: string;
  isComplete: boolean;
}

/**
 * Process a single chunk from the stream
 */
const processSingleChunk = (
  chunk: string,
  currPartialChunk: string | null,
): [any | null, string | null] => {
  const completeChunk = (currPartialChunk || '') + chunk;
  try {
    // Every complete chunk should be valid JSON
    const chunkJson = JSON.parse(completeChunk);
    return [chunkJson, null];
  } catch (err) {
    // If it's not valid JSON, then it's probably an incomplete chunk
    return [null, completeChunk];
  }
};

/**
 * Process raw chunk string that may contain multiple packets
 */
export const processRawChunkString = (
  rawChunkString: string,
  previousPartialChunk: string | null,
): [any[], string | null] => {
  if (!rawChunkString) {
    return [[], null];
  }

  const chunkSections = rawChunkString
    .split('\n')
    .filter((chunk) => chunk.length > 0);

  const parsedChunkSections: any[] = [];
  let currPartialChunk = previousPartialChunk;

  chunkSections.forEach((chunk) => {
    const [processedChunk, partialChunk] = processSingleChunk(
      chunk,
      currPartialChunk,
    );
    if (processedChunk) {
      parsedChunkSections.push(processedChunk);
      currPartialChunk = null;
    } else {
      currPartialChunk = partialChunk;
    }
  });

  return [parsedChunkSections, currPartialChunk];
};

// ─── Payload Templates ─────────────────────────────────────────────────────

/**
 * Build the Onyx 2.x send-message payload
 */
function buildPayloadV2(params: SendMessageParams): Record<string, unknown> {
  const documentsAreSelected =
    params.selectedDocumentIds && params.selectedDocumentIds.length > 0;

  return {
    alternate_assistant_id: params.alternateAssistantId,
    chat_session_id: params.chatSessionId,
    parent_message_id: params.parentMessageId,
    message: params.message,
    prompt_id: null,
    search_doc_ids: documentsAreSelected ? params.selectedDocumentIds : null,
    file_descriptors: params.fileDescriptors,
    current_message_files: params.currentMessageFiles,
    regenerate: params.regenerate,
    retrieval_options:
      params.retrieval_options ??
      (!documentsAreSelected
        ? {
            run_search:
              params.queryOverride || params.forceSearch ? 'always' : 'auto',
            real_time: true,
            filters: params.filters,
          }
        : null),
    query_override: params.queryOverride,
    prompt_override: {
      ...(params.systemPromptOverride
        ? { system_prompt: params.systemPromptOverride }
        : {}),
      ...(params.taskPromptOverride
        ? { task_prompt: params.taskPromptOverride }
        : {}),
    },
    llm_override:
      params.temperature || params.modelVersion
        ? {
            temperature: params.temperature,
            model_provider: params.modelProvider,
            model_version: params.modelVersion,
          }
        : null,
    use_existing_user_message: params.useExistingUserMessage,
    use_agentic_search: params.useAgentSearch ?? false,
    allowed_tool_ids: params.enabledToolIds,
    forced_tool_ids: params.forcedToolIds,
  };
}

/**
 * Build the Onyx 3.x send-message payload
 */
function buildPayloadV3(params: SendMessageParams): Record<string, unknown> {
  const payload = {
    message: params.message,
    chat_session_id: params.chatSessionId,
    parent_message_id: params.parentMessageId,
    file_descriptors: params.fileDescriptors ?? [],
    internal_search_filters: {
      source_type: params.filters?.source_type ?? ['web', 'github'],
      document_set: params.filters?.document_set ?? null,
      time_cutoff: params.filters?.time_cutoff ?? null,
      tags: params.filters?.tags ?? [],
    },
    deep_research: params.useAgentSearch ?? false,
    allowed_tool_ids: params.enabledToolIds?.length
      ? params.enabledToolIds
      : [1],
    forced_tool_id: params.forcedToolIds?.[0] ?? null,
    llm_override: {
      temperature: params.temperature ?? 0.5,
      model_provider:
        params.modelProvider || 'Inhouse LiteLLM provider oss 120b',
      model_version: params.modelVersion || 'Inhouse-LLM/gpt-oss-120b',
    },
    llm_overrides: null,
    origin: 'webapp',
    additional_context: null,
    alternate_assistant_id: params.alternateAssistantId ?? null,
    stream: true,
  };
  return payload;
}

/**
 * Normalise a raw Onyx 3.x stream object into the canonical { ind, obj } Packet shape.
 */
function normaliseV3Chunk(raw: any): Packet | null {
  // Bare identity packet (user/assistant message IDs – no placement wrapper)
  if ('user_message_id' in raw && 'reserved_assistant_message_id' in raw) {
    return {
      ind: -1,
      obj: {
        type: PacketType.MESSAGE_END_ID_INFO,
        user_message_id: raw.user_message_id,
        reserved_assistant_message_id: raw.reserved_assistant_message_id,
      },
    } as Packet;
  }

  if (!raw.placement || typeof raw.obj !== 'object') return null;

  const ind: number = raw.placement.turn_index ?? 0;
  const obj = raw.obj;

  // Map citation_number to citation_num for compatibility with CitationDelta consumers
  if (obj.type === PacketType.CITATION_INFO && 'citation_number' in obj) {
    obj.citation_num = obj.citation_number;
  }

  const normalised = { ind, obj } as Packet;
  // console.log('[Onyx v3] Normalised packet:', normalised);
  return normalised;
}

/**
 * Handle streaming response from the backend
 */
export async function* handleStream(
  streamingResponse: Response,
  onyxVersion: '2' | '3' = '2',
): AsyncGenerator<Packet[], void, unknown> {
  const reader = streamingResponse.body?.getReader();
  if (!reader) {
    throw new Error('No reader available from response');
  }

  const decoder = new TextDecoder('utf-8');
  let previousPartialChunk: string | null = null;

  while (true) {
    const rawChunk = await reader.read();
    if (!rawChunk) {
      throw new Error('Unable to process chunk');
    }

    const { done, value } = rawChunk;
    if (done) {
      break;
    }

    const [completedChunks, partialChunk] = processRawChunkString(
      decoder.decode(value, { stream: true }),
      previousPartialChunk,
    );

    if (onyxVersion === '3' && completedChunks.length > 0) {
      // console.log('[Onyx v3] Raw completed chunks:', completedChunks);
    }

    if (!completedChunks.length && !partialChunk) {
      break;
    }

    previousPartialChunk = partialChunk;

    // Convert chunks to packets
    const packets: Packet[] = completedChunks
      .filter((chunk) => chunk && typeof chunk === 'object')
      .map((chunk) => {
        if (onyxVersion === '3') {
          return normaliseV3Chunk(chunk);
        }

        // Onyx v2 format: { ind: number, obj: { type: string, ... } }
        if ('ind' in chunk && 'obj' in chunk) {
          return chunk as Packet;
        }

        // Handle MessageResponseIDInfo (special case without ind/obj)
        if (
          'user_message_id' in chunk &&
          'reserved_assistant_message_id' in chunk
        ) {
          // Just pass it through as is - MessageProcessor will handle it
          return {
            ind: -1,
            obj: {
              type: PacketType.MESSAGE_END_ID_INFO,
              user_message_id: chunk.user_message_id,
              reserved_assistant_message_id:
                chunk.reserved_assistant_message_id,
            },
          };
        }

        if ('error' in chunk) {
          return {
            ind: -1,
            obj: { type: PacketType.ERROR, error: chunk.error },
          };
        }
        // Handle legacy format if needed
        return null;
      })
      .filter((p): p is Packet => p !== null);

    if (packets.length > 0) {
      yield packets;
    }
  }
}

/**
 * Send a message and stream the response
 */
export async function* sendMessage(
  params: SendMessageParams,
  isRelatedQuestion: boolean = false,
): AsyncGenerator<Packet[], void, unknown> {
  const { onyxVersion = '2', signal } = params;

  const payload =
    onyxVersion === '3' ? buildPayloadV3(params) : buildPayloadV2(params);

  const body = JSON.stringify(payload);

  const middleware = isRelatedQuestion ? '_rq' : '_da';
  const endpoint =
    onyxVersion === '3' ? 'send-chat-message' : 'send-message';

  console.log(`[sendMessage] Target URL: /${middleware}/chat/${endpoint} (v${onyxVersion})`);
  console.log(`[sendMessage] Payload:`, payload);

  const sendMessageResponse = await fetch(`/${middleware}/chat/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    signal,
  });

  if (!sendMessageResponse.ok) {
    const errorJson = await sendMessageResponse.json();
    const errorMsg = errorJson.message || errorJson.detail || '';
    throw new Error(`Failed to send message - ${errorMsg}`);
  }

  yield* handleStream(sendMessageResponse, onyxVersion);
}

/**
 * Create a new chat session
 */
export async function createChatSession(
  personaId: number,
  description?: string,
  isRelatedQuestion: boolean = false,
): Promise<string> {
  const middleware = isRelatedQuestion ? '_rq' : '_da';
  const url = `/${middleware}/chat/create-chat-session`;
  console.log(`[createChatSession] URL: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      persona_id: personaId,
      description,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create chat session');
  }

  const data = await response.json();
  return data.chat_session_id;
}

/**
 * Submit feedback for a message
 */
export async function submitFeedback(params: {
  chatMessageId: number;
  feedbackText?: string;
  isPositive: boolean;
  predefinedFeedback?: string;
}): Promise<void> {
  const {
    chatMessageId,
    feedbackText = '',
    isPositive,
    predefinedFeedback = '',
  } = params;

  const payload: any = {
    chat_message_id: chatMessageId,
    feedback_text: feedbackText,
    is_positive: isPositive,
  };

  if (!isPositive) {
    payload.predefined_feedback = predefinedFeedback;
  }

  const response = await fetch('/_da/chat/create-chat-message-feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }

  await response.json();
}

/**
 * Regenerate a message
 */
export async function regenerateMessage(
  messageId: number,
  chatSessionId: number,
): Promise<void> {
  const response = await fetch('/_da/chat/regenerate-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message_id: messageId,
      chat_session_id: chatSessionId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to regenerate message');
  }
}
