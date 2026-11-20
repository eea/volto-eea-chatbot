import React from 'react';
import { useIntl, defineMessages } from 'react-intl';
import SVGIcon from './Icon';
import MicIcon from '@eeacms/volto-eea-chatbot/icons/mic.svg';

const messages = defineMessages({
  startVoiceInput: {
    id: 'Start voice input',
    defaultMessage: 'Start voice input',
  },
  stopVoiceInput: {
    id: 'Stop voice input',
    defaultMessage: 'Stop voice input',
  },
});

export interface MicButtonProps {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

/**
 * Composer microphone toggle, rendered next to the send button. The owning
 * component decides whether the browser supports speech recognition; this
 * component only renders the control. While recording it turns into a filled
 * button with a pulsing halo, and the transcript is written directly in the
 * composer input.
 */
const MicButton: React.FC<MicButtonProps> = ({
  isListening,
  onStart,
  onStop,
  disabled = false,
}) => {
  const intl = useIntl();
  const labelText = intl.formatMessage(
    isListening ? messages.stopVoiceInput : messages.startVoiceInput,
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isListening) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <button
      type="button"
      className={`mic-btn${isListening ? ' listening' : ''}`}
      aria-pressed={isListening}
      aria-label={labelText}
      title={labelText}
      disabled={disabled}
      onClick={handleClick}
    >
      {isListening && <span className="mic-halo" aria-hidden="true" />}
      <span className="mic-icon">
        <SVGIcon name={MicIcon} size={16} />
      </span>
    </button>
  );
};

export default MicButton;
