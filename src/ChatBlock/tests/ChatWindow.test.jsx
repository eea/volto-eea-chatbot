import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@plone/volto/helpers/Loadable', () => ({
  injectLazyLibs: (libs) => (Component) => (props) =>
    <Component {...props} rehypePrism={null} remarkGfm={null} />,
}));

jest.mock('@eeacms/volto-matomo/utils', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/hooks', () => ({
  useChatController: jest.fn(() => ({
    onSubmit: jest.fn(),
    onFetchRelatedQuestions: jest.fn(),
    messages: [],
    isStreaming: false,
    isFetchingRelatedQuestions: false,
    clearChat: jest.fn(),
    setIsDeepResearchEnabled: jest.fn(),
    isDeepResearchEnabled: false,
  })),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea', () => ({
  __esModule: true,
  default: ({ placeholder }) => (
    <textarea data-testid="autoresize-textarea" placeholder={placeholder} />
  ),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/EmptyState', () => ({
  __esModule: true,
  default: ({ onChoice }) => (
    <div data-testid="empty-state">
      <button onClick={() => onChoice('starter prompt')}>Starter</button>
    </div>
  ),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/QualityCheckToggle', () => ({
  __esModule: true,
  default: ({ enabled }) => (
    <div data-testid="quality-check-toggle" data-enabled={String(enabled)} />
  ),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => ({
  __esModule: true,
  default: () => <span data-testid="svg-icon" />,
}));

jest.mock('.', () => ({
  ChatMessage: () => <div data-testid="chat-message" />,
}), { virtual: true });

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/chat', () => ({
  ChatMessage: () => <div data-testid="chat-message" />,
}));

// Import the unwrapped ChatWindow (before injectLazyLibs wraps it)
// We need to import it through the module that injectLazyLibs passes through
import ChatWindowWrapped from '@eeacms/volto-eea-chatbot/ChatBlock/chat/ChatWindow';
import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks';

const mockPersona = {
  id: 1,
  name: 'Test Assistant',
  description: 'A test assistant',
};

describe('ChatWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });
  });

  it('renders landing page with empty state by default', () => {
    render(<ChatWindowWrapped persona={mockPersona} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders textarea with placeholder', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        placeholderPrompt="Ask me anything"
      />,
    );
    expect(screen.getByTestId('autoresize-textarea')).toHaveAttribute(
      'placeholder',
      'Ask me anything',
    );
  });

  it('renders persona name when showAssistantTitle is true', () => {
    render(
      <ChatWindowWrapped persona={mockPersona} showAssistantTitle={true} />,
    );
    expect(screen.getByText('Test Assistant')).toBeInTheDocument();
  });

  it('renders persona description when showAssistantDescription is true', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        showAssistantDescription={true}
      />,
    );
    expect(screen.getByText('A test assistant')).toBeInTheDocument();
  });

  it('does not render persona name when showAssistantTitle is false', () => {
    render(
      <ChatWindowWrapped persona={mockPersona} showAssistantTitle={false} />,
    );
    expect(screen.queryByText('Test Assistant')).not.toBeInTheDocument();
  });

  it('renders quality check toggle when qualityCheck is ondemand_toggle', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        qualityCheck="ondemand_toggle"
      />,
    );
    expect(screen.getByTestId('quality-check-toggle')).toBeInTheDocument();
  });

  it('does not render quality check toggle when qualityCheck is disabled', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        qualityCheck="disabled"
      />,
    );
    expect(screen.queryByTestId('quality-check-toggle')).not.toBeInTheDocument();
  });

  it('shows deep research label when deepResearch is always_on', () => {
    render(
      <ChatWindowWrapped persona={mockPersona} deepResearch="always_on" />,
    );
    expect(screen.getByText('Deep research on')).toBeInTheDocument();
  });

  it('shows messages and clear button when messages exist', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [
        {
          messageId: 1,
          message: 'Hello',
          type: 'user',
          packets: [],
          files: [],
          toolCall: null,
          parentNodeId: null,
          nodeId: 1,
        },
      ],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    render(<ChatWindowWrapped persona={mockPersona} />);
    expect(screen.getByText('New chat')).toBeInTheDocument();
  });

  it('shows bottom EmptyState when starterPromptsPosition is bottom', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        starterPromptsPosition="bottom"
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('does not show top EmptyState when starterPromptsPosition is bottom', () => {
    render(
      <ChatWindowWrapped
        persona={mockPersona}
        starterPromptsPosition="bottom"
      />,
    );
    // empty state is shown bottom only (once)
    expect(screen.getAllByTestId('empty-state')).toHaveLength(1);
  });

  it('sets playwright block id when isPlaywrightTest is true', () => {
    const { container } = render(
      <ChatWindowWrapped
        persona={mockPersona}
        block_id="test-block-id"
        isPlaywrightTest={true}
      />,
    );
    const chatWindow = container.querySelector('.chat-window');
    expect(chatWindow).toHaveAttribute(
      'data-playwright-block-id',
      'test-block-id',
    );
  });

  it('calls onSubmit when starter prompt is clicked', () => {
    const mockOnSubmit = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    render(<ChatWindowWrapped persona={mockPersona} />);
    fireEvent.click(screen.getByText('Starter'));
    expect(mockOnSubmit).toHaveBeenCalledWith({ message: 'starter prompt' });
  });

  it('shows loading indicator when streaming without final message', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [
        {
          messageId: 1,
          message: 'Hello',
          type: 'user',
          packets: [],
          files: [],
          toolCall: null,
          parentNodeId: null,
          nodeId: 1,
          isFinalMessageComing: false,
        },
      ],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    const { container } = render(<ChatWindowWrapped persona={mockPersona} />);
    expect(container.querySelector('.loader')).toBeInTheDocument();
  });
});
