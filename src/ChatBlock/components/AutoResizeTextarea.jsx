import React from 'react';
import { useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import TextareaAutosize from 'react-textarea-autosize';

import SVGIcon from './Icon';
import ArrowUpIcon from '@eeacms/volto-eea-chatbot/icons/arrow-up.svg';
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

function hasValidChildren(children) {
  return React.Children.toArray(children).some((child) => {
    if (!child) return false;
    if (React.isValidElement(child)) {
      if (child.type === React.Fragment) {
        return hasValidChildren(child.props.children);
      }
      return true;
    }
    return true;
  });
}

export default React.forwardRef(function AutoResizeTextarea(props, ref) {
  const {
    onSubmit,
    isStreaming,
    stopButton,
    enableStopButton = true,
    onCancel,
    enableMatomoTracking,
    persona,
    toolbarLeft,
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
  const hasToolbar = hasValidChildren(toolbarLeft);

  const actions = (
    <div className="chat-composer-toolbar-right chat-right-actions">
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
            <SVGIcon name={ArrowUpIcon} size={18} />
          </div>
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={`chat-composer ${hasToolbar ? 'has-toolbar' : 'no-toolbar'}`}
    >
      <div className="chat-composer-input">
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
      </div>

      {hasToolbar ? (
        <div className="chat-composer-toolbar">
          <div className="chat-composer-toolbar-left">{toolbarLeft}</div>
          {actions}
        </div>
      ) : (
        actions
      )}
    </div>
  );
});
