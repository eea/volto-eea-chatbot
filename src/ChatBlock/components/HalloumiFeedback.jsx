import React from 'react';
import cx from 'classnames';
import { Button, Message, MessageContent } from 'semantic-ui-react';
import { serializeNodes } from '@plone/volto-slate/editor/render';
import Spinner from './Spinner';
import SVGIcon from './Icon';
import { getSupportedBgColor } from './markdown/colors';

import GlassesIcon from '@eeacms/volto-eea-chatbot/icons/glasses.svg';
import RotateIcon from '@eeacms/volto-eea-chatbot/icons/rotate.svg';

const VERIFY_CLAIM_MESSAGES = [
  'Going through each claim and verify against the referenced documents...',
  'Summarising claim verifications results...',
  'Calculating scores...',
];

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

function VerifyClaims() {
  const [message, setMessage] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (message < VERIFY_CLAIM_MESSAGES.length - 1) {
        setMessage(message + 1);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="verify-claims">
      <Spinner />
      {VERIFY_CLAIM_MESSAGES[message]}
    </div>
  );
}

const HalloumiFeedback = ({
  halloumiMessage,
  isLoadingHalloumi,
  markers,
  score,
  scoreColor,
  onManualVerify,
  showVerifyClaimsButton,
  sources,
  retryHalloumi,
  emptyClaims,
  contextQuality,
}) => {
  const claims = (markers?.claims || []).filter((claim) => !claim.skipped);
  const limitedClaims = claims.filter((claim) => claim.context_limited);
  const noClaimsScore = claims[0]?.score === null;
  const messageBySource =
    'Please allow a few minutes for claim verification when many references are involved.';

  return (
    <>
      {showVerifyClaimsButton && (
        <div className="halloumi-feedback-button">
          <Button onClick={onManualVerify} className="icon claims-btn">
            <SVGIcon name={GlassesIcon} /> Fact-check AI answer
          </Button>
          <div>
            <span>{messageBySource}</span>{' '}
          </div>
        </div>
      )}

      {isLoadingHalloumi && sources.length > 0 && (
        <Message color="blue">
          <VerifyClaims />
        </Message>
      )}

      {noClaimsScore && (
        <>
          <Message color="red">{claims[0].rationale}</Message>
          <Button onClick={retryHalloumi} className="icon">
            <SVGIcon name={RotateIcon} /> Retry Fact-check AI answer
          </Button>
        </>
      )}

      {!!halloumiMessage && !!markers && !noClaimsScore && (
        <Message
          color={scoreColor}
          className={cx(
            'claim-message',
            emptyClaims
              ? 'claim-empty claim-gray-500'
              : getSupportedBgColor(score / 100, 'claim'),
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
