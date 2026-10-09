import type { ReactNode, MutableRefObject } from 'react';
import { useState, useCallback, useEffect } from 'react';

export const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

interface CreateChatMessageFeedbackArgs {
  chat_message_id: string;
  feedback_text?: string;
  is_positive: boolean;
  predefined_feedback?: string;
}

// Convert text with email addresses to mailto links
export function transformEmailsToLinks(text: string): (string | ReactNode)[] {
  return text.split(EMAIL_REGEX).map((part, index) => {
    if (EMAIL_REGEX.test(part)) {
      return (
        <a key={index} href={`mailto:${part}`} className="text-email">
          {part}
        </a>
      );
    }
    return part;
  });
}

export function debounce(
  callable: () => void,
  click_signal: MutableRefObject<boolean | null>,
): void {
  if (!click_signal.current) {
    click_signal.current = true;
    setTimeout(() => {
      click_signal.current = null;
    }, 1000);
    callable();
  }
}

export const useCopyToClipboard = (text: string): [boolean, () => void] => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [text]);

  useEffect(() => {
    if (!copied) return;

    const timeout = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timeout);
  }, [copied]);

  return [copied, copy];
};

/**
 * The fact-checker collapses its three verdicts into a per-claim score and does
 * not send the verdict itself (`verdict_scores` in `rag_facts_check/server.py`:
 * supported 1.0, not_enough_info 0.4, contradicted 0.0). The thresholds below are
 * therefore part of the contract — keep them in step with the backend.
 */
export type ClaimVerdict = 'supported' | 'not_enough_info' | 'contradicted';

export function scoreToVerdict(score: number): ClaimVerdict {
  if (score >= 0.8) return 'supported';
  if (score >= 0.1) return 'not_enough_info';
  return 'contradicted';
}

/**
 * Modal header copy. Names the outcome, never the process: "Verified Claim"
 * reads as "this is true" even when the check contradicted the claim, and the
 * old High/Low/Failed badge read as confidence levels for what are three
 * discrete verdicts.
 */
const VERDICT_HEADER: Record<ClaimVerdict, string> = {
  supported: 'Supported by the sources',
  not_enough_info: 'Not confirmed by the sources',
  contradicted: 'Contradicted by the sources',
};

const VERDICT_BADGE: Record<ClaimVerdict, string> = {
  supported: 'Supported',
  not_enough_info: 'Not confirmed',
  contradicted: 'Contradicted',
};

export function claimHeaderLabel(
  score: number,
  contextLimited = false,
): string {
  // Checked over search snippets only: the supporting text may simply have been
  // missing, so the verdict is not trustworthy enough to name.
  if (contextLimited) return "Couldn't be checked";
  return VERDICT_HEADER[scoreToVerdict(score)];
}

export function claimBadgeLabel(score: number, contextLimited = false): string {
  if (contextLimited) return 'Unverified';
  return VERDICT_BADGE[scoreToVerdict(score)];
}

export function convertToPercentage(
  floatValue: number,
  digits: number = 2,
): string {
  if (floatValue < 0 || floatValue > 1) {
    return '0%';
  }
  return (floatValue * 100).toFixed(digits) + '%';
}

export async function createChatMessageFeedback({
  chat_message_id,
  feedback_text = '',
  is_positive,
  predefined_feedback = '',
}: CreateChatMessageFeedbackArgs): Promise<any> {
  const payload: {
    chat_message_id: string;
    feedback_text: string;
    is_positive: boolean;
    predefined_feedback?: string;
  } = {
    chat_message_id,
    feedback_text,
    is_positive,
  };

  if (!is_positive) {
    payload.predefined_feedback = predefined_feedback;
  }

  const createChatMessageFeedbackResponse = await fetch(
    '/_da/chat/create-chat-message-feedback',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!createChatMessageFeedbackResponse.ok) {
    //eslint-disable-next-line no-console
    console.log(
      `Failed to submit feedback - ${createChatMessageFeedbackResponse.status}`,
    );
    throw Error(`Failed to submit feedback.`);
  }

  const createChatMessageFeedbackResponseJson =
    await createChatMessageFeedbackResponse.json();
  return await createChatMessageFeedbackResponseJson;
}
