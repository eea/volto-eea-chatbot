import { createContext } from 'react';
import type { Message } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

/**
 * Provides the currently-rendered chat message to deeply-nested descendants
 * (e.g. custom react-markdown components injected by an addon).
 *
 * Set by `ChatMessage`, so any component rendered inside a given message
 * (including custom markdown elements) can read the message that owns it —
 * e.g. to match a `![[doc: Title]]` marker against `message.documents`.
 */
export const ChatMessageContext = createContext<Message | null>(null);
