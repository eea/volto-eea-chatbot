import type { Message } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

// The context is re-sent on every turn and Onyx injects it ahead of the newest
// question, so it competes with the session's own history for the model budget.
export const MAX_TRANSCRIPT_CHARS = 32000;

export const TRUNCATION_MARKER = '[Earlier conversation truncated]';

/** True when the handed-over transcript is missing its beginning. */
export function isTruncated(transcript: string | null): boolean {
  return Boolean(transcript && transcript.startsWith(TRUNCATION_MARKER));
}

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

  const whole = lines.join('\n\n');
  if (whole.length <= maxChars) return whole;

  // The marker is part of what we send, so it comes out of the budget.
  const budget = Math.max(0, maxChars - TRUNCATION_MARKER.length - 2);
  const kept: string[] = [];
  let total = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const addition = lines[index].length + (kept.length > 0 ? 2 : 0);
    if (total + addition > budget) break;
    kept.unshift(lines[index]);
    total += addition;
  }

  if (kept.length === 0) {
    // A single turn over budget: keep its tail.
    const newest = lines[lines.length - 1];
    return `${TRUNCATION_MARKER}\n\n${newest.slice(newest.length - budget)}`;
  }

  return `${TRUNCATION_MARKER}\n\n${kept.join('\n\n')}`;
}
