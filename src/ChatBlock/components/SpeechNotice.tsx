import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import SVGIcon from './Icon';
import ClearIcon from '@eeacms/volto-eea-chatbot/icons/clear.svg';

const messagesI18n = defineMessages({
  privacyNote: {
    id: 'Audio is processed by your browser’s speech service and is not stored by EEA.',
    defaultMessage:
      'Audio is processed by your browser’s speech service and is not stored by EEA.',
  },
  dismiss: {
    id: 'Dismiss',
    defaultMessage: 'Dismiss',
  },
  microphoneUnavailable: {
    id: 'Voice input is not available in this browser.',
    defaultMessage: 'Voice input is not available in this browser.',
  },
  insecureContext: {
    id: 'Voice input requires a secure (HTTPS) connection.',
    defaultMessage: 'Voice input requires a secure (HTTPS) connection.',
  },
  permissionDenied: {
    id: 'Microphone access was blocked. Allow the microphone in your browser settings and try again.',
    defaultMessage:
      'Microphone access was blocked. Allow the microphone in your browser settings and try again.',
  },
  noMicrophone: {
    id: 'No microphone was found. Connect a microphone and try again.',
    defaultMessage: 'No microphone was found. Connect a microphone and try again.',
  },
  network: {
    id: 'Voice input needs a network connection. Check your connection and try again.',
    defaultMessage:
      'Voice input needs a network connection. Check your connection and try again.',
  },
  languageNotSupported: {
    id: 'Voice input does not support the current language.',
    defaultMessage: 'Voice input does not support the current language.',
  },
  serviceNotAllowed: {
    id: 'Voice input is not allowed on this device.',
    defaultMessage: 'Voice input is not allowed on this device.',
  },
  generic: {
    id: 'Voice input failed. Please try again or type your question.',
    defaultMessage: 'Voice input failed. Please try again or type your question.',
  },
});

export type SpeechErrorMessage = { id: string; defaultMessage: string };

const ERROR_MESSAGES: Record<string, SpeechErrorMessage> = {
  'not-allowed': messagesI18n.permissionDenied,
  'audio-capture': messagesI18n.noMicrophone,
  network: messagesI18n.network,
  'language-not-supported': messagesI18n.languageNotSupported,
  'service-not-allowed': messagesI18n.serviceNotAllowed,
  'insecure-context': messagesI18n.insecureContext,
  unsupported: messagesI18n.microphoneUnavailable,
};

/** Map a `SpeechRecognitionErrorEvent.error` code to translatable copy. */
export function getSpeechErrorMessage(code?: string | null): SpeechErrorMessage {
  if (!code) return messagesI18n.generic;
  return ERROR_MESSAGES[code] ?? messagesI18n.generic;
}

export interface SpeechNoticeProps {
  /** Raw `SpeechRecognitionErrorEvent.error` code. */
  error?: string | null;
  showPrivacyNote?: boolean;
  onDismissError?: () => void;
  onDismissPrivacyNote?: () => void;
}

const DismissButton: React.FC<{
  onClick?: () => void;
  label: string;
}> = ({ onClick, label }) => (
  <button
    type="button"
    className="speech-notice-dismiss"
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    <SVGIcon name={ClearIcon} size={12} />
  </button>
);

/**
 * Inline feedback for voice input: permission or device errors and the one-time
 * mic usage disclosure. The live transcript is rendered in the composer input
 * itself, so it never pushes the layout around.
 */
const SpeechNotice: React.FC<SpeechNoticeProps> = ({
  error,
  showPrivacyNote = false,
  onDismissError,
  onDismissPrivacyNote,
}) => {
  const intl = useIntl();
  const dismissLabel = intl.formatMessage(messagesI18n.dismiss);

  if (!error && !showPrivacyNote) {
    return null;
  }

  return (
    <div className="speech-notices">
      {error && (
        <div className="speech-notice is-error" role="status">
          <span className="speech-notice-text">
            <FormattedMessage {...getSpeechErrorMessage(error)} />
          </span>
          <DismissButton onClick={onDismissError} label={dismissLabel} />
        </div>
      )}

      {showPrivacyNote && (
        <div className="speech-notice">
          <span className="speech-notice-text">
            <FormattedMessage {...messagesI18n.privacyNote} />
          </span>
          <DismissButton onClick={onDismissPrivacyNote} label={dismissLabel} />
        </div>
      )}
    </div>
  );
};

export default SpeechNotice;
