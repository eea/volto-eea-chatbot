import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer from 'react-test-renderer';
import {
  render,
  fireEvent,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import UserActionsToolbar from '@eeacms/volto-eea-chatbot/ChatBlock/components/UserActionsToolbar';

import { trackEvent } from '@eeacms/volto-matomo/utils';
import { shareChatSession } from '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService';

jest.mock('@eeacms/volto-matomo/utils', () => ({ trackEvent: jest.fn() }));

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService',
  () => {
    const actual = jest.requireActual(
      '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService',
    );
    return {
      ...actual,
      shareChatSession: jest.fn().mockResolvedValue(true),
    };
  },
);

const mockStore = configureStore();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('UserActionsToolbar', () => {
  let store;

  beforeEach(() => {
    store = mockStore({
      userSession: { token: '1234' },
      intl: { locale: 'en', messages: {} },
    });
    jest.clearAllMocks();
    navigator.clipboard.writeText.mockResolvedValue(undefined);
  });

  const renderComponent = (props) =>
    renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          <UserActionsToolbar {...props} />
        </MemoryRouter>
      </Provider>,
    );

  const renderWithRTL = (props) =>
    render(
      <Provider store={store}>
        <MemoryRouter>
          <UserActionsToolbar {...props} />
        </MemoryRouter>
      </Provider>,
    );

  it('renders toolbar with copy button', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Test message content',
      },
      enableFeedback: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders toolbar with feedback when enabled', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Test message content',
      },
      enableFeedback: true,
      feedbackReasons: ['Incorrect', 'Unhelpful'],
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with custom className', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Test message content',
      },
      className: 'custom-toolbar',
      enableFeedback: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('copies message to clipboard when copy button is clicked', async () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Test message to copy',
      },
      enableFeedback: false,
    };

    renderWithRTL(props);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Test message to copy',
    );
    await waitFor(() => expect(copyButton).toBeDisabled());
  });

  it.each([
    [undefined, undefined, 'Chatbot'],
    [{ name: 'Environment' }, undefined, 'Chatbot - Environment'],
    [{ name: 'Search Assist' }, 'Search - AI summary', 'Search - AI summary'],
  ])(
    'tracks successful copy in the correct context (%j, %s)',
    async (persona, matomoCategory, category) => {
      let resolveCopy;
      navigator.clipboard.writeText.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCopy = resolve;
        }),
      );
      renderWithRTL({
        message: { messageId: 1, message: 'Private generated text' },
        enableMatomoTracking: true,
        persona,
        matomoCategory,
      });

      const button = screen.getByRole('button', { name: /copy/i });
      act(() => {
        button.click();
        button.click();
        button.click();
      });
      expect(trackEvent).not.toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

      await act(async () => resolveCopy());
      expect(trackEvent).toHaveBeenCalledTimes(1);
      expect(trackEvent).toHaveBeenCalledWith({
        category,
        action: 'Response copied',
      });
      expect(button).toBeDisabled();
    },
  );

  it('honours tracking opt-out while a clipboard write is pending', async () => {
    let resolveCopy;
    navigator.clipboard.writeText.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCopy = resolve;
      }),
    );
    const props = {
      message: { message: 'Private text' },
      enableMatomoTracking: true,
    };
    const { rerender } = renderWithRTL(props);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    rerender(
      <Provider store={store}>
        <MemoryRouter>
          <UserActionsToolbar {...props} enableMatomoTracking={false} />
        </MemoryRouter>
      </Provider>,
    );
    await act(async () => resolveCopy());
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not track failed clipboard writes', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Denied'));
    renderWithRTL({
      message: { message: 'Private text' },
      enableMatomoTracking: true,
    });
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await act(async () => {});
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /copy/i })).toBeEnabled();
  });

  it('does not track successful copies when tracking is disabled', async () => {
    renderWithRTL({
      message: { message: 'Private text' },
      enableMatomoTracking: false,
    });
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled(),
    );
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('handles empty message gracefully', () => {
    const props = {
      message: {
        messageId: 1,
        message: '',
      },
      enableFeedback: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles undefined message gracefully', () => {
    const props = {
      message: null,
      enableFeedback: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders Share button when chatSessionId is provided and copies link on click', async () => {
    const props = {
      message: { messageId: 1, message: 'Test message' },
      chatSessionId: 'session-uuid-1234',
      enableMatomoTracking: true,
    };

    renderWithRTL(props);

    const shareButton = screen.getByRole('button', {
      name: /share conversation/i,
    });
    expect(shareButton).toBeInTheDocument();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareChatSession).toHaveBeenCalledWith('session-uuid-1234');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('?chat=session-uuid-1234'),
      );
    });

    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot',
      action: 'Conversation shared',
    });
  });

  it('triggers shareChatSession only once when clicking share multiple times', async () => {
    const props = {
      message: { messageId: 1, message: 'Test message' },
      chatSessionId: 'session-uuid-1234',
    };

    renderWithRTL(props);

    const shareButton = screen.getByRole('button', {
      name: /share conversation/i,
    });

    // First click
    fireEvent.click(shareButton);
    await waitFor(() => {
      expect(shareChatSession).toHaveBeenCalledTimes(1);
    });

    // Second click on the same toolbar should not call shareChatSession again
    fireEvent.click(shareButton);
    expect(shareChatSession).toHaveBeenCalledTimes(1);
  });

  it('does not render Share button when chatSessionId is not provided', () => {
    const props = {
      message: { messageId: 1, message: 'Test message' },
      chatSessionId: null,
    };

    renderWithRTL(props);

    expect(
      screen.queryByRole('button', { name: /share conversation/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render Share button when enableShare is false', () => {
    const props = {
      message: { messageId: 1, message: 'Test message' },
      chatSessionId: 'session-uuid-1234',
      enableShare: false,
    };

    renderWithRTL(props);

    expect(
      screen.queryByRole('button', { name: /share conversation/i }),
    ).not.toBeInTheDocument();
  });

  it('renders Download button when enableDownload is true', () => {
    const props = {
      message: { messageId: 1, message: 'Test message' },
      enableDownload: true,
    };

    renderWithRTL(props);

    expect(
      screen.getByRole('button', { name: /export conversation/i }),
    ).toBeInTheDocument();
  });

  it('renders Start a new conversation pill button when onNewChat is provided', () => {
    const mockNewChat = jest.fn();
    const props = {
      message: { messageId: 1, message: 'Test message' },
      onNewChat: mockNewChat,
      enableMatomoTracking: true,
    };

    renderWithRTL(props);

    const newChatBtn = screen.getByRole('button', {
      name: /start a new conversation/i,
    });
    expect(newChatBtn).toBeInTheDocument();

    fireEvent.click(newChatBtn);
    expect(mockNewChat).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot',
      action: 'Start new conversation',
      name: 'Message actions',
    });
  });
});
