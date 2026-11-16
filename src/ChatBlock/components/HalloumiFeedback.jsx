import React from 'react';
import cx from 'classnames';
import { Button, Message, MessageContent } from 'semantic-ui-react';
import { defineMessages, useIntl } from 'react-intl';
import { serializeNodes } from '@plone/volto-slate/editor/render';
import SVGIcon from './Icon';
import { getVerdictBgColor } from './markdown/colors';

import GlassesIcon from '@eeacms/volto-eea-chatbot/icons/glasses.svg';
import RotateIcon from '@eeacms/volto-eea-chatbot/icons/rotate.svg';

/**
 * Seconds to wait before a failed check can be retried. Purely a brake - the
 * hard limit is the attempt cap in useQualityMarkers. Without it, an impatient
 * user hammering Retry spends a full LLM run per click against a service that
 * is already struggling.
 */
const RETRY_COOLDOWN_SECONDS = 5;

const messages = defineMessages({
  factCheck: {
    id: 'Fact-check AI answer',
    defaultMessage: 'Fact-check AI answer',
  },
  factCheckChecking: {
    id: 'Fact-checking',
    defaultMessage: 'Fact-checking…',
  },
  factCheckHint: {
    id: 'Please allow a few minutes for claim verification when many references are involved.',
    defaultMessage:
      'Please allow a few minutes for claim verification when many references are involved.',
  },
  resolvingEvidence: {
    id: 'Gathering the cited documents…',
    defaultMessage: 'Gathering the cited documents…',
  },
  checkingSources: {
    id: 'Checking this answer against {count, plural, one {# source} other {# sources}}…',
    defaultMessage:
      'Checking this answer against {count, plural, one {# source} other {# sources}}…',
  },
  elapsed: {
    id: '{seconds}s elapsed',
    defaultMessage: '{seconds}s elapsed',
  },
  takingLong: {
    id: 'This is taking longer than usual. You can cancel, or let it keep running.',
    defaultMessage:
      'This is taking longer than usual. You can cancel, or let it keep running.',
  },
  cancel: { id: 'Cancel', defaultMessage: 'Cancel' },
  retry: {
    id: 'Retry Fact-check AI answer',
    defaultMessage: 'Retry Fact-check AI answer',
  },
  retryIn: {
    id: 'Retry available in {seconds}s',
    defaultMessage: 'Retry available in {seconds}s',
  },
  retriesExhausted: {
    id: 'Fact-checking is unavailable right now. Please try again later.',
    defaultMessage:
      'Fact-checking is unavailable right now. Please try again later.',
  },
  errorNoSources: {
    id: 'There are no sources to check this answer against.',
    defaultMessage: 'There are no sources to check this answer against.',
  },
  errorUnreachable: {
    id: 'Fact-checking is temporarily unavailable.',
    defaultMessage: 'Fact-checking is temporarily unavailable.',
  },
  errorBusy: {
    id: 'Fact-checking is busy right now.',
    defaultMessage: 'Fact-checking is busy right now.',
  },
  errorTimeout: {
    id: 'Fact-checking took too long for this answer.',
    defaultMessage: 'Fact-checking took too long for this answer.',
  },
  errorTimeoutHint: {
    id: 'The answer may cite more text than can be verified in one pass. Nothing is wrong with the answer itself.',
    defaultMessage:
      'The answer may cite more text than can be verified in one pass. Nothing is wrong with the answer itself.',
  },
  errorUnreachableHint: {
    id: 'The answer is unchanged - only the verification failed.',
    defaultMessage: 'The answer is unchanged - only the verification failed.',
  },
});

function visitTextNodes(node, visitor) {
  if (Array.isArray(node)) {
    node.forEach((child) => visitTextNodes(child, visitor));
  } else if (node && typeof node === 'object') {
    if (node.text !== undefined) {
      visitor(node);
    }
    if (node.children) {
      visitTextNodes(node.children, visitor);
    }
  }
}

function printSlate(value, score) {
  if (typeof value === 'string') {
    return value.replaceAll('{score}', score);
  }
  function visitor(node) {
    if (node.text.indexOf('{score}') > -1) {
      node.text = node.text.replaceAll('{score}', score);
    }
  }

  visitTextNodes(value, visitor);
  return serializeNodes(value);
}

/**
 * A live elapsed counter. Honest progress beats the old three canned messages
 * on a 5s timer, which reached "Calculating scores…" after 10 seconds and sat
 * there - implying work was nearly done when the request had not returned at
 * all.
 */
function useElapsed(active) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  return seconds;
}

/**
 * Copy for a failed check. Each outcome needs its own sentence: telling someone
 * the service is down when the answer was simply too big to verify in time is
 * both wrong and unactionable.
 */
function errorCopy(intl, error) {
  switch (error?.outcome) {
    case 'no_sources':
      return { message: intl.formatMessage(messages.errorNoSources) };
    case 'busy':
      return { message: intl.formatMessage(messages.errorBusy) };
    case 'timeout':
      return {
        message: intl.formatMessage(messages.errorTimeout),
        hint: intl.formatMessage(messages.errorTimeoutHint),
      };
    default:
      return {
        message: intl.formatMessage(messages.errorUnreachable),
        hint: intl.formatMessage(messages.errorUnreachableHint),
      };
  }
}

/**
 * The ring used wherever a fact-check is running.
 *
 * Not the shared `Spinner` component: that one is a 22px two-tone teal/blue
 * disc, which is right for a page loader and far too heavy inside a button or a
 * one-line status strip.
 */
function SpinnerRing() {
  return <span aria-hidden="true" className="fact-check-spinner" />;
}

const HalloumiFeedback = ({
  halloumiMessage,
  markers,
  score,
  scoreColor,
  onManualVerify,
  showVerifyClaimsButton,
  retryHalloumi,
  emptyClaims,
  contextQuality,
  phase = 'idle',
  sourceCount = 0,
  error = null,
  canRetry = true,
  onCancelCheck,
}) => {
  const intl = useIntl();
  const isChecking = phase === 'resolving_evidence' || phase === 'checking';
  const elapsed = useElapsed(isChecking);
  const [cooldown, setCooldown] = React.useState(0);

  // Brake after a failure. Keyed on the error object so a new failure restarts
  // the countdown, and cleared as soon as a check is running again.
  React.useEffect(() => {
    if (isChecking || phase !== 'failed') {
      setCooldown(0);
      return;
    }
    setCooldown(RETRY_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [error, phase, isChecking]);

  const claims = (markers?.claims || []).filter((claim) => !claim.skipped);
  const limitedClaims = claims.filter((claim) => claim.context_limited);

  const stageCopy =
    phase === 'resolving_evidence'
      ? intl.formatMessage(messages.resolvingEvidence)
      : intl.formatMessage(messages.checkingSources, { count: sourceCount });

  const failure = phase === 'failed' ? errorCopy(intl, error) : null;

  return (
    <>
      {showVerifyClaimsButton && (
        <div className="halloumi-feedback-button">
          <Button
            onClick={onManualVerify}
            className="icon claims-btn"
            disabled={isChecking}
            aria-busy={isChecking}
            aria-label={
              isChecking
                ? intl.formatMessage(messages.factCheckChecking)
                : intl.formatMessage(messages.factCheck)
            }
          >
            <span
              className="claims-btn-label"
              aria-hidden={isChecking ? 'true' : undefined}
            >
              <SVGIcon name={GlassesIcon} />{' '}
              {intl.formatMessage(messages.factCheck)}
            </span>
            {isChecking && (
              <span className="claims-btn-progress">
                <SpinnerRing /> {intl.formatMessage(messages.factCheckChecking)}
              </span>
            )}
          </Button>
          {!isChecking && phase !== 'failed' && (
            <div>
              <span>{intl.formatMessage(messages.factCheckHint)}</span>{' '}
            </div>
          )}
        </div>
      )}

      {/* One strip for the whole check, including the document-resolution stage
          that happens before the fact-checker is called at all. Built from
          design-system tokens rather than a Semantic Message: the blue box, its
          heavy border and the two-tone disc read as an alert, and a check that
          is merely taking its time is not an alert. */}
      {isChecking && (
        <div className="fact-check-progress">
          <SpinnerRing />
          <span
            className="fact-check-progress-text"
            role="status"
            aria-live="polite"
          >
            {stageCopy}
          </span>
          <span className="fact-check-progress-elapsed">
            {intl.formatMessage(messages.elapsed, { seconds: elapsed })}
          </span>
          {onCancelCheck && (
            <button
              className="fact-check-progress-cancel"
              type="button"
              onClick={onCancelCheck}
            >
              {intl.formatMessage(messages.cancel)}
            </button>
          )}
          {elapsed >= 60 && (
            <span className="fact-check-progress-note">
              {intl.formatMessage(messages.takingLong)}
            </span>
          )}
        </div>
      )}

      {failure && (
        <div
          className="fact-check-error"
          data-outcome={error?.outcome || 'unreachable'}
        >
          <span className="fact-check-error-text">{failure.message}</span>
          {/* The action comes before the explanation: it belongs on the first
              line with the message, and the hint wraps below. */}
          {canRetry && error?.outcome !== 'no_sources' ? (
            <button
              className="fact-check-error-retry"
              type="button"
              onClick={retryHalloumi}
              disabled={cooldown > 0}
            >
              <SVGIcon name={RotateIcon} />{' '}
              {cooldown > 0
                ? intl.formatMessage(messages.retryIn, { seconds: cooldown })
                : intl.formatMessage(messages.retry)}
            </button>
          ) : (
            !canRetry && (
              <span className="fact-check-error-hint">
                {intl.formatMessage(messages.retriesExhausted)}
              </span>
            )
          )}
          {failure.hint && (
            <span className="fact-check-error-hint">{failure.hint}</span>
          )}
        </div>
      )}

      {!!halloumiMessage && !!markers && (
        <Message
          color={scoreColor}
          className={cx(
            'claim-message',
            // The summary chip wears the same three hues as the claims it
            // summarises - the old eight-step red-to-green gradient implied a
            // precision the score never had, skipped yellow entirely, and gave a
            // colour-blind reader one ramp instead of three findings.
            emptyClaims
              ? 'claim-empty claim-gray-500'
              : getVerdictBgColor(score / 100),
          )}
          icon
        >
          <MessageContent>
            {emptyClaims || printSlate(halloumiMessage, `${score}%`)}
          </MessageContent>
        </Message>
      )}

      {/* The fact-checker only saw part of the answer's sources, so a "not
          confirmed" verdict may mean missing text rather than a mistake. Said
          once, at answer level - the claim modal already says "Couldn't be
          checked" and needs no repeat of this. */}
      {contextQuality?.level === 'partial' && (
        <Message color="yellow" className="context-quality-message">
          <MessageContent>
            <strong>Some sources could not be loaded in full.</strong>{' '}
            {limitedClaims.length > 0
              ? `${limitedClaims.length} ${
                  limitedClaims.length === 1 ? 'claim was' : 'claims were'
                } checked against short excerpts, so “not confirmed” may mean missing text rather than a mistake.`
              : 'Every claim was still matched against the text that was available, so this did not change the result.'}
          </MessageContent>
        </Message>
      )}
    </>
  );
};

export default HalloumiFeedback;
