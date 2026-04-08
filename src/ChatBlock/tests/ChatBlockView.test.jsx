import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatBlockView from '@eeacms/volto-eea-chatbot/ChatBlock/ChatBlockView';

// Mock withOnyxData to transparently pass props through
jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/hocs/withOnyxData', () => {
  return (_callback) => (Component) => Component;
});

jest.mock('superagent', () => ({
  get: jest.fn().mockReturnValue({ type: jest.fn().mockReturnThis() }),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/chat', () => ({
  ChatWindow: ({ persona, isEditMode, block_id }) => (
    <div
      data-testid="chat-window"
      data-persona={persona?.id}
      data-edit-mode={String(isEditMode)}
      data-block-id={block_id}
    >
      ChatWindow
    </div>
  ),
}));

describe('ChatBlockView', () => {
  const defaultProps = {
    id: 'block-1',
    data: { assistant: 42 },
    location: { search: '' },
  };

  it('renders fallback when assistantData is not available', () => {
    render(<ChatBlockView {...defaultProps} />);
    expect(screen.getByText('Chatbot')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-window')).not.toBeInTheDocument();
  });

  it('renders ChatWindow when assistantData is available', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
  });

  it('passes block_id to ChatWindow', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-block-id',
      'block-1',
    );
  });

  it('passes isEditMode to ChatWindow', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      isEditMode: true,
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-edit-mode',
      'true',
    );
  });

  it('sets window.__EEA_CHATBOT_TEST_CONFIG__ when playwright=yes', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: { search: '?playwright=yes' },
    };

    act(() => {
      render(<ChatBlockView {...props} />);
    });

    expect(window.__EEA_CHATBOT_TEST_CONFIG__).toBeDefined();
    expect(window.__EEA_CHATBOT_TEST_CONFIG__.block_id).toBe('block-1');
    expect(window.__EEA_CHATBOT_TEST_CONFIG__.assistant).toBe(42);
  });

  it('does not set window.__EEA_CHATBOT_TEST_CONFIG__ without playwright param', () => {
    delete window.__EEA_CHATBOT_TEST_CONFIG__;
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: { search: '' },
    };

    act(() => {
      render(<ChatBlockView {...props} />);
    });

    expect(window.__EEA_CHATBOT_TEST_CONFIG__).toBeUndefined();
  });
});
