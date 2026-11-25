import type { Message } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

export const MAX_TRANSCRIPT_CHARS = 8000;

const TRUNCATION_MARKER = '[Earlier conversation truncated]';

/** Context handed to the assistant a conversation is forked to. */
export function flattenTranscript(
  messages: Message[] | null | undefined,
  maxChars: number = MAX_TRANSCRIPT_CHARS,
): string | null {
  const lines: string[] = [];

  const failed = (message?: Message | null) =>
    !message || message.type === 'error' || Boolean(message.error);

  (messages || []).forEach((message, index) => {
    if (message.type !== 'user' && message.type !== 'assistant') return;
    // Stream errors arrive as assistant messages with an `error` field.
    if (failed(message)) return;
    const next = messages?.[index + 1];
    if (message.type === 'user' && next && failed(next)) return;
    const text = (message.message || '').trim();
    if (!text) return;
    lines.push(`${message.type === 'user' ? 'User' : 'Assistant'}: ${text}`);
  });

  if (lines.length === 0) return null;

  const kept: string[] = [];
  let total = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const addition = lines[index].length + (kept.length > 0 ? 2 : 0);
    if (total + addition > maxChars) break;
    kept.unshift(lines[index]);
    total += addition;
  }

  if (kept.length === 0) {
    // A single turn over budget: keep its tail.
    const newest = lines[lines.length - 1];
    const budget = Math.max(0, maxChars - TRUNCATION_MARKER.length - 2);
    return `${TRUNCATION_MARKER}\n\n${newest.slice(newest.length - budget)}`;
  }

  return kept.length < lines.length
    ? `${TRUNCATION_MARKER}\n\n${kept.join('\n\n')}`
    : kept.join('\n\n');
}
