import { useRef, useState, useEffect } from 'react';
import cx from 'classnames';
import { useIntl, defineMessages, FormattedMessage } from 'react-intl';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import { Button } from 'semantic-ui-react';
import { useCopyToClipboard } from '@eeacms/volto-eea-chatbot/ChatBlock/utils';
import { copyShareLink } from '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService';
import SVGIcon from './Icon';
import ChatMessageFeedback from './ChatMessageFeedback';
import { ChatExportDropdown } from './ChatExportDropdown';

import CopyIcon from '@eeacms/volto-eea-chatbot/icons/copy.svg';
import CheckIcon from '@eeacms/volto-eea-chatbot/icons/check.svg';
import ShareIcon from '@eeacms/volto-eea-chatbot/icons/share.svg';
import PenIcon from '@eeacms/volto-eea-chatbot/icons/square-pen.svg';

const messagesI18n = defineMessages({
  copy: {
    id: 'Copy',
    defaultMessage: 'Copy',
  },
  copied: {
    id: 'Copied!',
    defaultMessage: 'Copied!',
  },
  shareConversation: {
    id: 'Share conversation',
    defaultMessage: 'Share conversation',
  },
  linkCopied: {
    id: 'Link copied!',
    defaultMessage: 'Link copied!',
  },
  startNewConversation: {
    id: 'Start a new conversation',
    defaultMessage: 'Start a new conversation',
  },
});

const UserActionsToolbar = ({
  className,
  message,
  allMessages,
  chatSessionId,
  onNewChat,
  enableFeedback = true,
  feedbackReasons,
  enableMatomoTracking,
  matomoCategory,
  persona,
  enableDownload = true,
  isLoading = false,
}) => {
  const [copied, handleCopy] = useCopyToClipboard(message?.message || '');
  const [isCopiedShareLink, setIsCopiedShareLink] = useState(false);
  const shareTimeoutRef = useRef(null);
  const trackingEnabled = useRef(enableMatomoTracking);
  trackingEnabled.current = enableMatomoTracking;
  const intl = useIntl();

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  const handleShare = async () => {
    if (!chatSessionId) return;
    const ok = await copyShareLink(chatSessionId);
    if (ok) {
      setIsCopiedShareLink(true);
      if (trackingEnabled.current) {
        trackEvent({
          category:
            matomoCategory ||
            (persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot'),
          action: 'Conversation shared',
        });
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      shareTimeoutRef.current = setTimeout(() => {
        setIsCopiedShareLink(false);
      }, 2000);
    }
  };

  const exportMessages =
    Array.isArray(allMessages) && allMessages.length > 0
      ? allMessages
      : message
        ? [message]
        : [];

  return (
    <div className={cx('message-actions', className)}>
      <div className="message-actions-left">
        <Button
          basic
          className="chat-action-btn chat-copy-btn"
          onClick={async () => {
            const success = await handleCopy();
            if (success && trackingEnabled.current) {
              trackEvent({
                category:
                  matomoCategory ||
                  (persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot'),
                action: 'Response copied',
              });
            }
          }}
          title={intl.formatMessage(messagesI18n.copy)}
          aria-label={intl.formatMessage(messagesI18n.copy)}
          disabled={copied}
        >
          {copied ? <SVGIcon name={CheckIcon} /> : <SVGIcon name={CopyIcon} />}
        </Button>

        {chatSessionId && (
          <Button
            basic
            className="chat-action-btn chat-share-btn"
            onClick={handleShare}
            disabled={isCopiedShareLink}
            title={
              isCopiedShareLink
                ? intl.formatMessage(messagesI18n.linkCopied)
                : intl.formatMessage(messagesI18n.shareConversation)
            }
            aria-label={
              isCopiedShareLink
                ? intl.formatMessage(messagesI18n.linkCopied)
                : intl.formatMessage(messagesI18n.shareConversation)
            }
          >
            {isCopiedShareLink ? (
              <SVGIcon name={CheckIcon} />
            ) : (
              <SVGIcon name={ShareIcon} />
            )}
          </Button>
        )}

        {enableDownload && exportMessages.length > 0 && (
          <ChatExportDropdown
            messages={exportMessages}
            persona={persona}
            disabled={isLoading}
            hideWhenEmpty={false}
          />
        )}

        {enableFeedback && (
          <ChatMessageFeedback
            message={message}
            feedbackReasons={feedbackReasons}
            enableMatomoTracking={enableMatomoTracking}
            matomoCategory={matomoCategory}
            persona={persona}
          />
        )}
      </div>

      {onNewChat && (
        <div className="message-actions-right">
          <Button
            onClick={onNewChat}
            disabled={isLoading}
            className="start-new-chat-btn"
            aria-label={intl.formatMessage(messagesI18n.startNewConversation)}
            title={intl.formatMessage(messagesI18n.startNewConversation)}
          >
            <SVGIcon name={PenIcon} size={14} />{' '}
            <FormattedMessage
              id="Start a new conversation"
              defaultMessage="Start a new conversation"
            />
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserActionsToolbar;
