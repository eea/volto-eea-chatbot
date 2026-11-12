import React from 'react';
import { useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import TextareaAutosize from 'react-textarea-autosize';

import SVGIcon from './Icon';
import ArrowUpIcon from '@eeacms/volto-eea-chatbot/icons/arrow-up.svg';
import StopIcon from '@eeacms/volto-eea-chatbot/icons/stop.svg';
import McpToolProposal from './McpToolProposal';
import { findSuggestedMcpTool } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/mcpToolMatching';

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
    toolbarRight,
    availableTools = [],
    selectedToolIds = [],
    onEnableTool,
    ...rest
  } = props;
  const intl = useIntl();
  const [input, setInput] = React.useState('');
  const [dismissedToolIds, setDismissedToolIds] = React.useState(
    () => new Set(),
  );
  const localTextareaRef = React.useRef(null);

  const setTextareaRef = (element) => {
    localTextareaRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  const suggestedTool = React.useMemo(() => {
    return findSuggestedMcpTool(
      input,
      availableTools,
      selectedToolIds,
      dismissedToolIds,
    );
  }, [input, availableTools, selectedToolIds, dismissedToolIds]);

  const handleAcceptProposal = (proposal) => {
    const match = proposal || suggestedTool;
    const tool = match?.tool || match;
    if (!tool) return;
    if (onEnableTool) {
      onEnableTool(tool.id);
    }

    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'MCP tool selected',
        name: (tool.display_name || tool.name || '').trim(),
      });
    }

    const toolTag = `@${(tool.display_name || tool.name).trim()}`;
    const textarea = localTextareaRef.current;

    if (
      match &&
      typeof match.matchIndex === 'number' &&
      match.matchLength > 0
    ) {
      const { matchIndex, matchLength } = match;
      const before = input.slice(0, matchIndex);
      const after = input.slice(matchIndex + matchLength);

      const needsPreSpace = before.length > 0 && !before.endsWith(' ');
      const needsPostSpace =
        after.length === 0 ||
        (!after.startsWith(' ') && !/^[.,!?;:)]/.test(after));

      const replacement = `${needsPreSpace ? ' ' : ''}${toolTag}${needsPostSpace ? ' ' : ''}`;
      const newText = `${before}${replacement}${after}`;
      setInput(newText);

      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newPos = before.length + replacement.length;
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else if (textarea) {
      const start = textarea.selectionStart ?? input.length;
      const end = textarea.selectionEnd ?? input.length;
      const before = input.slice(0, start);
      const after = input.slice(end);
      const needsPreSpace = before.length > 0 && !before.endsWith(' ');
      const newText = `${before}${needsPreSpace ? ' ' : ''}${toolTag} ${after}`;
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        const newPos = start + (needsPreSpace ? 1 : 0) + toolTag.length + 1;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      const separator = input.length > 0 && !input.endsWith(' ') ? ' ' : '';
      setInput((prev) => `${prev}${separator}${toolTag} `);
    }
  };

  const handleDismissProposal = (tool) => {
    if (!tool) return;
    setDismissedToolIds((prev) => new Set([...prev, tool.id]));
  };

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
      {toolbarRight}
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
      {suggestedTool && (
        <McpToolProposal
          tool={suggestedTool}
          onAccept={handleAcceptProposal}
          onDismiss={handleDismissProposal}
        />
      )}

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
          ref={setTextareaRef}
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
