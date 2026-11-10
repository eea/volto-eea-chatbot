import React from 'react';
import { useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import TextareaAutosize from 'react-textarea-autosize';

import SVGIcon from './Icon';
import SendIcon from '@eeacms/volto-eea-chatbot/icons/send.svg';
import StopIcon from '@eeacms/volto-eea-chatbot/icons/stop.svg';

const messages = defineMessages({
  send: {
    id: 'Send',
    defaultMessage: 'Send',
  },
  stopGenerating: {
    id: 'Stop generating',
    defaultMessage: 'Stop generating',
  },
});

export default React.forwardRef(function AutoResizeTextarea(props, ref) {
  const {
    onSubmit,
    isStreaming,
    stopButton,
    enableStopButton = true,
    onCancel,
    enableMatomoTracking,
    persona,
    ...rest
  } = props;
  const intl = useIntl();
  const [input, setInput] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (trimmedInput) {
      if (enableMatomoTracking) {
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: 'Chatbot: Type a question',
          name: 'Message submitted',
        });
      }
      onSubmit({ message: input });
      setInput('');
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'Chatbot: Stop generating',
        name: 'Message generation stopped',
      });
    }
    if (onCancel) {
      onCancel();
    }
  };

  const resolvedStopButton =
    stopButton || (enableStopButton === false ? 'disabled' : 'floating');
  const showStopButton = Boolean(resolvedStopButton === 'input' && isStreaming);

  return (
    <>
      <TextareaAutosize
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit(e);
          } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            setInput(input + '\n');
          }
        }}
        disabled={isStreaming}
        {...rest}
        ref={ref}
      />

      <div className="chat-right-actions">
        {showStopButton ? (
          <Button
            className="stop-btn"
            type="button"
            aria-label={intl.formatMessage(messages.stopGenerating)}
            onClick={handleCancel}
          >
            <div className="btn-icon">
              <SVGIcon name={StopIcon} size={14} color="#fff" />
            </div>
          </Button>
        ) : (
          <Button
            className="submit-btn"
            type="submit"
            aria-label={intl.formatMessage(messages.send)}
            onKeyDown={(e) => {
              handleSubmit(e);
            }}
            disabled={isStreaming || input.trim() === ''}
            onClick={(e) => {
              handleSubmit(e);
            }}
          >
            <div className="btn-icon">
              <SVGIcon name={SendIcon} size="28" />
            </div>
          </Button>
        )}
      </div>
    </>
  );
});
