import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import the unwrapped ChatWindow (before injectLazyLibs wraps it)
// We need to import it through the module that injectLazyLibs passes through
import ChatWindowWrapped from '@eeacms/volto-eea-chatbot/ChatBlock/chat/ChatWindow';
import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks';
import {
  getSharedChatSession,
  deserializeChatSession,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService';

import { trackEvent } from '@eeacms/volto-matomo/utils';

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService',
  () => ({
    getSharedChatSession: jest.fn(),
    deserializeChatSession: jest.fn(),
    copyShareLink: jest.fn().mockResolvedValue(true),
  }),
);

jest.mock('@plone/volto/helpers/Loadable', () => ({
  injectLazyLibs: (libs) => (Component) => (props) => (
    <Component {...props} rehypePrism={null} remarkGfm={null} />
  ),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }) => defaultMessage }),
  defineMessages: (msgs) => msgs,
  FormattedMessage: ({ defaultMessage }) => <span>{defaultMessage}</span>,
}));

jest.mock('@eeacms/volto-matomo/utils', () => ({
  trackEvent: jest.fn(),
}));

const mockHistory = { push: jest.fn(), replace: jest.fn() };
jest.mock('react-router-dom', () => ({
  useHistory: () => mockHistory,
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/hooks', () => ({
  useChatController: jest.fn(() => ({
    onSubmit: jest.fn(),
    onFetchRelatedQuestions: jest.fn(),
    messages: [],
    isStreaming: false,
    isFetchingRelatedQuestions: false,
    clearChat: jest.fn(),
    cancelStreaming: jest.fn(),
    setIsDeepResearchEnabled: jest.fn(),
    isDeepResearchEnabled: false,
    selectedToolIds: [],
    availableTools: [],
    toggleTool: jest.fn(),
    enableTool: jest.fn(),
  })),
}));

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea',
  () => ({
    __esModule: true,
    default: ({
      placeholder,
      isStreaming,
      stopButton,
      onCancel,
      toolbarLeft,
      toolbarRight,
      onSubmit,
    }) => (
      <div>
        <textarea data-testid="autoresize-textarea" placeholder={placeholder} />
        {toolbarLeft && (
          <div data-testid="mock-toolbar-left">{toolbarLeft}</div>
        )}
        {toolbarRight && (
          <div data-testid="mock-toolbar-right">{toolbarRight}</div>
        )}
        {stopButton === 'input' && isStreaming && (
          <button data-testid="mock-stop-button" onClick={onCancel}>
            Stop
          </button>
        )}
        <button
          data-testid="mock-submit-button"
          onClick={() => onSubmit && onSubmit({ message: 'follow-up' })}
        >
          Submit
        </button>
      </div>
    ),
  }),
);

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/EmptyState', () => ({
  __esModule: true,
  default: ({ onChoice }) => (
    <div data-testid="empty-state">
      <button onClick={() => onChoice('starter prompt')}>Starter</button>
    </div>
  ),
}));

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/QualityCheckToggle',
  () => ({
    __esModule: true,
    default: ({ enabled }) => (
      <div data-testid="quality-check-toggle" data-enabled={String(enabled)} />
    ),
  }),
);

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => ({
  __esModule: true,
  default: () => <span data-testid="svg-icon" />,
}));

jest.mock(
  '.',
  () => ({
    ChatMessage: () => <div data-testid="chat-message" />,
  }),
  { virtual: true },
);

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/chat', () => ({
  ChatMessage: () => <div data-testid="chat-message" />,
}));

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
    render(<ChatWindowWrapped persona={mockPersona} qualityCheck="disabled" />);
    expect(
      screen.queryByTestId('quality-check-toggle'),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByRole('button', { name: /start a new conversation/i }),
    ).toBeInTheDocument();
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

  // Auto-submit from URL parameter tests
  it('initialQuery triggers auto-submit on mount', () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: false,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(
      <ChatWindowWrapped persona={mockPersona} initialQuery="auto question" />,
    );

    expect(mockOnSubmit).toHaveBeenCalledWith({ message: 'auto question' });
  });

  it('initialDeepResearch sets deep research toggle state', () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: false,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialQuery="test"
        initialDeepResearch="true"
      />,
    );

    expect(mockSetIsDeepResearchEnabled).toHaveBeenCalledWith(true);
  });

  it('URL is cleaned after auto-submit via history.replace', async () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: false,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(<ChatWindowWrapped persona={mockPersona} initialQuery="clean me" />);

    await waitFor(() =>
      expect(mockHistory.replace).toHaveBeenCalledWith('/assistant-page'),
    );
  });

  it('does not auto-submit into a shared conversation', () => {
    const mockOnSubmit = jest.fn().mockResolvedValue({ accepted: true });
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      loadChatSession: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });
    getSharedChatSession.mockResolvedValue({
      chat_session_id: 'shared-1',
      persona_id: 1,
      messages: [],
    });
    deserializeChatSession.mockReturnValue([]);

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialChatSessionId="shared-1"
        initialQuery="should not be sent"
      />,
    );

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('auto-submits once the active assistant is resolved, even if the alternatives load later', () => {
    const mockOnSubmit = jest.fn().mockResolvedValue({ accepted: true });
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });

    const { rerender } = render(
      <ChatWindowWrapped
        persona={mockPersona}
        personaOptions={[mockPersona]}
        personaOptionsLoading
        initialAssistantId="1"
        initialQuery="deep link question"
      />,
    );

    // The active assistant is already known: the question must not wait for
    // the alternatives, and it must not be lost if they settle later.
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <ChatWindowWrapped
        persona={mockPersona}
        personaOptions={[
          mockPersona,
          { id: 2, name: 'Climate Assistant', description: '' },
        ]}
        personaOptionsLoading={false}
        initialAssistantId="1"
        initialQuery="deep link question"
      />,
    );

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('falls back to the block default when the selected assistant never loads', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        personaOptions={[mockPersona]}
        personaOptionsLoading={false}
        offeredAssistantIds={['1', '2']}
        initialAssistantId="2"
      />,
    );

    // Assistant 2 was offered but its record never arrived.
    expect(useChatController).toHaveBeenLastCalledWith(
      expect.objectContaining({ personaId: 1 }),
    );
  });

  it('keeps the question in the url when the submit was rejected', async () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn().mockResolvedValue({ accepted: false }),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/ask-ai',
      search: '?query=retry+me',
    });

    render(<ChatWindowWrapped persona={mockPersona} initialQuery="retry me" />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'We could not start the conversation. Please try again.',
      ),
    );
    expect(mockHistory.replace).not.toHaveBeenCalled();
  });

  it('auto-submits a url question exactly once to the named assistant', () => {
    const mockOnSubmit = jest.fn().mockResolvedValue({ accepted: true });
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        personaOptions={[mockPersona, { id: 2, name: 'Climate Assistant' }]}
        initialAssistantId="2"
        initialQuery="climate question"
      />,
    );

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith({ message: 'climate question' });
    expect(useChatController).toHaveBeenLastCalledWith(
      expect.objectContaining({ personaId: 2 }),
    );
  });

  it('tells the visitor when the conversation could not be started', async () => {
    const mockOnSubmit = jest.fn().mockResolvedValue({ accepted: false });
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
    });

    render(
      <ChatWindowWrapped persona={mockPersona} initialQuery="hello there" />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'We could not start the conversation. Please try again.',
      );
    });
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('keeps every other url parameter when the question is consumed', async () => {
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

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/ask-ai',
      search: '?query=hello&assistant=2&deepResearch=true',
    });

    render(<ChatWindowWrapped persona={mockPersona} initialQuery="hello" />);

    await waitFor(() =>
      expect(mockHistory.replace).toHaveBeenCalledWith(
        '/ask-ai?assistant=2&deepResearch=true',
      ),
    );
  });

  it('no auto-submit if messages already exist', () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [
        {
          messageId: 1,
          message: 'Existing message',
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
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: false,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialQuery="should not submit"
      />,
    );

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('no auto-submit if streaming is in progress', () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: false,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialQuery="should not submit"
      />,
    );

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('initialDeepResearch=false sets toggle to false', () => {
    const mockOnSubmit = jest.fn();
    const mockSetIsDeepResearchEnabled = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: mockOnSubmit,
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      setIsDeepResearchEnabled: mockSetIsDeepResearchEnabled,
      isDeepResearchEnabled: true,
    });

    jest.spyOn(window, 'location', 'get').mockReturnValue({
      pathname: '/assistant-page',
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialQuery="test"
        initialDeepResearch="false"
      />,
    );

    expect(mockSetIsDeepResearchEnabled).toHaveBeenCalledWith(false);
  });

  it('passes cancelStreaming to AutoResizeTextarea and triggers it when stopButton is input', () => {
    const mockCancel = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: mockCancel,
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    render(<ChatWindowWrapped persona={mockPersona} stopButton="input" />);
    const stopBtn = screen.getByTestId('mock-stop-button');
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('renders floating stop button and triggers cancelStreaming when stopButton is floating', () => {
    const mockCancel = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: mockCancel,
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    const { container } = render(
      <ChatWindowWrapped persona={mockPersona} stopButton="floating" />,
    );
    const floatingBtn = container.querySelector('.floating-stop-btn');
    expect(floatingBtn).toBeInTheDocument();
    fireEvent.click(floatingBtn);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('defaults to floating stop button when stopButton is not specified', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    const { container } = render(<ChatWindowWrapped persona={mockPersona} />);
    expect(container.querySelector('.floating-stop-btn')).toBeInTheDocument();
  });

  it('renders message loader stop button and triggers cancelStreaming when stopButton is message_loader', () => {
    const mockCancel = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [
        {
          message: 'Hello',
          messageId: 1,
          type: 'user',
          nodeId: 1,
          isFinalMessageComing: false,
          packets: [],
        },
      ],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: mockCancel,
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    const { container } = render(
      <ChatWindowWrapped persona={mockPersona} stopButton="message_loader" />,
    );
    const loaderBtn = container.querySelector('.message-loader-stop-btn');
    expect(loaderBtn).toBeInTheDocument();
    fireEvent.click(loaderBtn);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('does not render stop buttons when stopButton is disabled', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: true,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
    });

    const { container } = render(
      <ChatWindowWrapped persona={mockPersona} stopButton="disabled" />,
    );
    expect(screen.queryByTestId('mock-stop-button')).not.toBeInTheDocument();
    expect(
      container.querySelector('.floating-stop-btn'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.message-loader-stop-btn'),
    ).not.toBeInTheDocument();
  });

  it('renders McpToolSelector when availableTools are present', () => {
    useChatController.mockReturnValueOnce({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [1],
      availableTools: [
        { id: 1, name: 'internal_search', display_name: 'Internal Search' },
        {
          id: 10,
          name: 'data',
          display_name: 'Data Connector',
          mcp_server_id: 1,
        },
      ],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    render(
      <ChatWindowWrapped persona={mockPersona} enableToolSelection={true} />,
    );
    expect(screen.getByRole('button', { name: /Tools/i })).toBeInTheDocument();
  });

  it('tracks MCP tool enabling and disabling when toggled', () => {
    const mockTools = [
      { id: 10, name: 'data_connector', display_name: 'EEA Data Connector' },
    ];
    const mockToggle = jest.fn();

    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      chatSessionId: null,
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      resetChatSessionId: jest.fn(),
      loadChatSession: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: mockTools,
      toggleTool: mockToggle,
      enableTool: jest.fn(),
    });

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        enableToolSelection={true}
        enableMatomoTracking={true}
      />,
    );

    const trigger = screen.getByRole('button', { name: /tools/i });
    fireEvent.click(trigger);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockToggle).toHaveBeenCalledWith(10);
    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot - Test Assistant',
      action: 'MCP tool enabled',
      name: 'EEA Data Connector',
    });
  });

  it('passes enableDownload and chatSessionId to ChatMessage when messages exist', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [{ messageId: 1, type: 'assistant', message: 'Hello' }],
      chatSessionId: 'test-session-123',
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    render(<ChatWindowWrapped persona={mockPersona} enableDownload={true} />);
    expect(screen.getByTestId('chat-message')).toBeInTheDocument();
  });

  it('does not render ChatExportDropdown in toolbarRight when enableDownload is false', () => {
    useChatController.mockReturnValueOnce({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [{ role: 'user', message: 'Hi' }],
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    render(<ChatWindowWrapped persona={mockPersona} enableDownload={false} />);
    expect(
      screen.queryByRole('button', { name: /export/i }),
    ).not.toBeInTheDocument();
  });

  it('renders Start a new conversation button when messages exist', () => {
    const mockClearChat = jest.fn();
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
      chatSessionId: 'test-session-uuid-1234',
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: mockClearChat,
      resetChatSessionId: jest.fn(),
      loadChatSession: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    render(
      <ChatWindowWrapped persona={mockPersona} enableMatomoTracking={true} />,
    );
    const newChatBtn = screen.getByRole('button', {
      name: /start a new conversation/i,
    });
    expect(newChatBtn).toBeInTheDocument();

    fireEvent.click(newChatBtn);
    expect(mockClearChat).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot - Test Assistant',
      action: 'Start new conversation',
      name: 'Top toolbar',
    });
  });

  it('loads shared session on mount via initialChatSessionId', async () => {
    const mockLoadChatSession = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      chatSessionId: null,
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      resetChatSessionId: jest.fn(),
      loadChatSession: mockLoadChatSession,
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    getSharedChatSession.mockResolvedValueOnce({
      chat_session_id: 'shared-uuid-5678',
      messages: [{ message_id: 1, message: 'Shared' }],
    });
    deserializeChatSession.mockReturnValueOnce([
      { messageId: 1, type: 'assistant', message: 'Shared' },
    ]);

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialChatSessionId="shared-uuid-5678"
      />,
    );

    expect(getSharedChatSession).toHaveBeenCalledWith('shared-uuid-5678');
    await waitFor(() => {
      expect(mockLoadChatSession).toHaveBeenCalledWith('shared-uuid-5678', [
        { messageId: 1, type: 'assistant', message: 'Shared' },
      ]);
    });
  });

  it('renders shared conversation notice and input form to allow continuation in shared view', async () => {
    const mockClearChat = jest.fn();
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      chatSessionId: 'shared-uuid-5678',
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: mockClearChat,
      resetChatSessionId: jest.fn(),
      loadChatSession: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    getSharedChatSession.mockResolvedValueOnce({
      chat_session_id: 'shared-uuid-5678',
      messages: [{ message_id: 1, message: 'Shared answer' }],
    });
    deserializeChatSession.mockReturnValueOnce([
      { messageId: 1, type: 'assistant', message: 'Shared answer' },
    ]);

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialChatSessionId="shared-uuid-5678"
        enableMatomoTracking={true}
      />,
    );

    const banner = await screen.findByText(
      /you are viewing a shared conversation/i,
    );
    expect(banner).toBeInTheDocument();

    // Textarea form is accessible to allow continuing the conversation
    expect(screen.getByTestId('autoresize-textarea')).toBeInTheDocument();

    // Submitting follow-up triggers continuation tracking strictly on the first message
    const submitBtn = screen.getByTestId('mock-submit-button');
    fireEvent.click(submitBtn);

    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot - Test Assistant',
      action: 'Shared conversation continued',
      name: 'shared-uuid-5678',
    });

    const continuationCalls = trackEvent.mock.calls.filter(
      (c) => c[0]?.action === 'Shared conversation continued',
    );
    expect(continuationCalls).toHaveLength(1);

    // Second message sent must NOT trigger continuation tracking again
    fireEvent.click(submitBtn);
    const continuationCallsAfterSecond = trackEvent.mock.calls.filter(
      (c) => c[0]?.action === 'Shared conversation continued',
    );
    expect(continuationCallsAfterSecond).toHaveLength(1);
  });

  it('renders loading state while shared session is loading and hides the composer', () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      chatSessionId: null,
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      resetChatSessionId: jest.fn(),
      loadChatSession: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    // Unresolved promise simulates in-flight fetch
    getSharedChatSession.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialChatSessionId="loading-uuid-1234"
      />,
    );

    expect(
      screen.getByText(/loading shared conversation/i),
    ).toBeInTheDocument();
    expect(container.querySelector('.shared-chat-spinner')).toBeInTheDocument();
    // Composer input should be hidden while loading
    expect(screen.queryByTestId('mock-textarea')).not.toBeInTheDocument();
  });

  it('renders error state when shared session fails to load', async () => {
    useChatController.mockReturnValue({
      onSubmit: jest.fn(),
      onFetchRelatedQuestions: jest.fn(),
      messages: [],
      chatSessionId: null,
      isStreaming: false,
      isFetchingRelatedQuestions: false,
      clearChat: jest.fn(),
      resetChatSessionId: jest.fn(),
      loadChatSession: jest.fn(),
      cancelStreaming: jest.fn(),
      setIsDeepResearchEnabled: jest.fn(),
      isDeepResearchEnabled: false,
      selectedToolIds: [],
      availableTools: [],
      toggleTool: jest.fn(),
      enableTool: jest.fn(),
    });

    getSharedChatSession.mockRejectedValueOnce(new Error('404 Not Found'));

    render(
      <ChatWindowWrapped
        persona={mockPersona}
        initialChatSessionId="invalid-uuid"
      />,
    );

    const errorMsg = await screen.findByText(
      /this shared conversation could not be found or is private/i,
    );
    expect(errorMsg).toBeInTheDocument();

    const newConvBtn = screen.getByRole('button', {
      name: /start a new conversation/i,
    });
    expect(newConvBtn).toBeInTheDocument();
  });
  describe('assistant selector', () => {
    const otherPersona = {
      id: 2,
      name: 'Climate Assistant',
      description: 'A climate assistant',
    };
    const selectablePersona = (props = {}) => (
      <ChatWindowWrapped
        persona={mockPersona}
        personaOptions={[mockPersona, otherPersona]}
        initialAssistantId="1"
        {...props}
      />
    );

    it('renders no selector when the block offers a single assistant', () => {
      render(<ChatWindowWrapped persona={mockPersona} />);
      expect(
        screen.queryByRole('button', { name: /Assistant:/ }),
      ).not.toBeInTheDocument();
    });

    it('renders no selector when the editor previews the block', () => {
      render(selectablePersona({ isEditMode: true }));
      expect(
        screen.queryByRole('button', { name: /Assistant:/ }),
      ).not.toBeInTheDocument();
    });

    it('renders the selector in the composer actions', () => {
      render(selectablePersona());
      const toolbarRight = screen.getByTestId('mock-toolbar-right');
      expect(toolbarRight).toContainElement(
        screen.getByRole('button', { name: /Assistant:/ }),
      );
    });

    it('switches the assistant without asking for a new conversation', () => {
      render(
        selectablePersona({
          showAssistantTitle: true,
          showAssistantDescription: true,
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: /Assistant:/ }));
      fireEvent.click(screen.getByText('Climate Assistant'));

      expect(
        screen.getByRole('heading', { name: 'Climate Assistant' }),
      ).toBeInTheDocument();
      expect(screen.getByText('A climate assistant')).toBeInTheDocument();
      expect(useChatController).toHaveBeenLastCalledWith(
        expect.objectContaining({ personaId: 2 }),
      );
    });

    it('reports the switch to analytics under the assistant being left', () => {
      render(selectablePersona());
      fireEvent.click(screen.getByRole('button', { name: /Assistant:/ }));
      fireEvent.click(screen.getByText('Climate Assistant'));

      expect(trackEvent).toHaveBeenCalledWith({
        category: 'Chatbot - Test Assistant',
        action: 'Assistant switched',
        name: 'Climate Assistant',
      });
    });

    it('cannot be switched while a response is streaming', () => {
      useChatController.mockReturnValue({
        onSubmit: jest.fn(),
        onFetchRelatedQuestions: jest.fn(),
        messages: [{ messageId: 1, nodeId: 1, type: 'user', message: 'hi' }],
        isStreaming: true,
        isFetchingRelatedQuestions: false,
        clearChat: jest.fn(),
        setIsDeepResearchEnabled: jest.fn(),
        isDeepResearchEnabled: false,
        selectedToolIds: [],
        availableTools: [],
      });

      render(selectablePersona());

      expect(screen.getByRole('button', { name: /Assistant:/ })).toBeDisabled();
    });

    it('adopts the assistant recorded on a shared conversation', async () => {
      useChatController.mockReturnValue({
        onSubmit: jest.fn(),
        onFetchRelatedQuestions: jest.fn(),
        messages: [],
        isStreaming: false,
        isFetchingRelatedQuestions: false,
        clearChat: jest.fn(),
        loadChatSession: jest.fn(),
        setIsDeepResearchEnabled: jest.fn(),
        isDeepResearchEnabled: false,
        selectedToolIds: [],
        availableTools: [],
      });
      getSharedChatSession.mockResolvedValue({
        chat_session_id: 'shared-1',
        persona_id: 2,
        persona_name: 'Climate Assistant',
        messages: [],
      });
      deserializeChatSession.mockReturnValue([
        { messageId: 1, nodeId: 1, type: 'user', message: 'hello' },
      ]);

      render(selectablePersona({ initialChatSessionId: 'shared-1' }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Assistant:/ }),
        ).toHaveTextContent('Climate Assistant');
      });
    });
  });
});
