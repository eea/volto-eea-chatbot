import { Modal, ModalContent, ModalHeader } from 'semantic-ui-react';
import cx from 'classnames';
import {
  claimBadgeLabel,
  claimHeaderLabel,
  claimScaleState,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import { getVerdictBgColor } from './colors';
import { ClaimSegments } from './ClaimSegments';

import BotIcon from '@eeacms/volto-eea-chatbot/icons/bot.svg';

const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

function stripMarkdown(md) {
  return (
    stripHtml(md)
      .replace(/[`*_~>#-]/g, '') // formatting chars
      .replace(/\n{2,}/g, '\n') // extra newlines
      // [[1]](url) → <sup>1</sup>
      .replace(/\[\[(\d+)\]\]\([^)]*\)/g, '<sup>$1</sup>')
      // optional: strip normal markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
  );
}

const trimNonAlphanumeric = (str) =>
  stripMarkdown(str).replace(/(?:^[^a-zA-Z0-9]+)|(?:[^a-zA-Z0-9]+$)/g, '');

export function ClaimModal({ claim, markers, text, citedSources }) {
  const highlightText = trimNonAlphanumeric(text || '');

  return (
    <Modal
      className={cx('claim-modal', getVerdictBgColor(claim.score))}
      trigger={
        <span className={cx('claim', getVerdictBgColor(claim.score))}>
          {text}
        </span>
      }
    >
      <ModalHeader>
        <div className="claim-modal-header">
          <div className="claim-header-top">
            <div className="circle assistant">
              <SVGIcon name={BotIcon} size="20" color="white" />
            </div>
            <span className="claim-label">
              {claimHeaderLabel(claim.score, claim.context_limited)}
            </span>
          </div>
          <blockquote className="claim-quote">
            &ldquo;
            <span
              dangerouslySetInnerHTML={{
                __html: stripMarkdown(claim.claimString).replace(
                  highlightText,
                  `<b>${highlightText}</b>`,
                ),
              }}
            />
            &rdquo;
          </blockquote>
        </div>
      </ModalHeader>
      <ModalContent>
        <div className="claim-verification-card">
          <div className="score-badge-section">
            <div className="score-badge">
              <span className="score-percentage">
                {claimBadgeLabel(claim.score, claim.context_limited)}
              </span>
              <span className="score-label">Fact check</span>
            </div>
            {/* Three discrete positions, not a fill. The per-claim score is a
                verdict, not a probability: the old proportional bar made
                not_enough_info look like "40% verified", which was never
                measured. Decorative — the badge text carries the verdict. */}
            <div
              className="verdict-scale"
              data-verdict={claimScaleState(claim.score, claim.context_limited)}
              aria-hidden="true"
            >
              <span className="verdict-step" />
              <span className="verdict-step" />
              <span className="verdict-step" />
            </div>
          </div>
          <div className="rationale-section">
            <h5 className="rationale-header">Rationale</h5>
            <p className="claim-rationale">{claim.rationale}</p>
            {/* No snippet caveat here: the header already says "Couldn't be
                checked" and the badge says "Unverified". The explanation lives
                once, at answer level, in HalloumiFeedback. */}
          </div>
        </div>

        <ClaimSegments
          segmentIds={claim.segmentIds}
          segments={markers?.segments || {}}
          citedSources={citedSources}
        />
      </ModalContent>
    </Modal>
  );
}
