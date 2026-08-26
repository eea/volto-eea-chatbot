import { Message as SemanticMessage } from 'semantic-ui-react';
import type { ChatMessageProps } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { UserMessage, AIMessage } from '.';
import { ChatMessageContext } from './MessageContext';

export function ChatMessage(props: ChatMessageProps) {
  const { message, libs, className = '' } = props;

  let content: React.ReactNode = null;

  if (message.type === 'user') {
    content = (
      <UserMessage
        message={message}
        libs={libs}
        className={className}
        isLoading={props.isLoading}
      />
    );
  } else if (message.type === 'assistant') {
    content = <AIMessage {...props} />;
  } else if (message.type === 'error') {
    content = (
      <div className="message-error">
        <SemanticMessage color="red" className="error-message">
          <div className="error-title">Error</div>
          <div className="error-content">{message.error}</div>
        </SemanticMessage>
      </div>
    );
  }

  if (content === null) return null;

  // Expose the owning message to deeply-nested descendants (e.g. custom
  // markdown components injected by addons via `extraMarkdownComponents`).
  return (
    <ChatMessageContext.Provider value={message}>
      {content}
    </ChatMessageContext.Provider>
  );
}
