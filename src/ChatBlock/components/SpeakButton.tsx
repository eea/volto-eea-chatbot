import { useId, useMemo } from 'react';
import { useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import SVGIcon from './Icon';
import VolumeIcon from '@eeacms/volto-eea-chatbot/icons/volume.svg';
import VolumeOffIcon from '@eeacms/volto-eea-chatbot/icons/volume-off.svg';
import { useSpeechSynthesis } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useSpeechSynthesis';
import { toSpeakableText } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/speechText';

const messagesI18n = defineMessages({
  readAloud: {
    id: 'Read answer aloud',
    defaultMessage: 'Read answer aloud',
  },
  stopReading: {
    id: 'Stop reading',
    defaultMessage: 'Stop reading',
  },
});

export interface SpeakButtonProps {
  /** Markdown answer body; it is reduced to plain text before playback. */
  text: string;
  /** BCP-47 tag or site locale; resolved by the hook when omitted. */
  lang?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Per-message text-to-speech toggle. Renders nothing when the browser has no
 * speech synthesis support or the answer has nothing to say.
 */
const SpeakButton = ({
  text,
  lang,
  disabled = false,
  className = 'chat-speak-btn',
}: SpeakButtonProps) => {
  const intl = useIntl();
  const instanceId = useId();
  const speakable = useMemo(() => toSpeakableText(text), [text]);
  const { isSupported, isSpeaking, toggle } = useSpeechSynthesis({
    id: instanceId,
    text: speakable,
    lang,
  });

  if (!isSupported || !speakable) {
    return null;
  }

  const labelText = intl.formatMessage(
    isSpeaking ? messagesI18n.stopReading : messagesI18n.readAloud,
  );

  return (
    <Button
      basic
      toggle
      active={isSpeaking}
      className={`chat-action-btn ${className}${isSpeaking ? ' speaking' : ''}`}
      onClick={toggle}
      disabled={disabled}
      title={labelText}
      aria-label={labelText}
    >
      <SVGIcon name={isSpeaking ? VolumeOffIcon : VolumeIcon} />
    </Button>
  );
};

export default SpeakButton;
