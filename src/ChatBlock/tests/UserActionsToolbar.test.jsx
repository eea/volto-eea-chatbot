import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer from 'react-test-renderer';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import UserActionsToolbar from '../components/UserActionsToolbar';

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
});
