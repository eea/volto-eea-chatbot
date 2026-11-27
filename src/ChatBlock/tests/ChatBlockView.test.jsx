import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatBlockView, {
  assistantDataDescriptor,
} from '@eeacms/volto-eea-chatbot/ChatBlock/ChatBlockView';

const superagent = require('superagent');

// Mock withOnyxData to transparently pass props through
jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/hocs/withOnyxData', () => {
  return (_callback) => (Component) => Component;
});

jest.mock('superagent', () => ({
  get: jest.fn((url) => {
    const request = {
      abort: jest.fn(),
      type: jest.fn(() => request),
      then: (onFulfilled, onRejected) =>
        Promise.resolve({
          body: { id: url.split('/').pop(), name: 'Persona' },
        }).then(onFulfilled, onRejected),
    };
    return request;
  }),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/chat', () => ({
  ChatWindow: ({
    persona,
    personaOptions = [],
    initialAssistantId,
    isEditMode,
    block_id,
    initialQuery,
    initialDeepResearch,
    initialChatSessionId,
  }) => (
    <div
      data-testid="chat-window"
      data-persona={persona?.id}
      data-persona-count={String(personaOptions.length)}
      data-persona-ids={personaOptions.map((p) => p.id).join(',')}
      data-initial-assistant={initialAssistantId || ''}
      data-edit-mode={String(isEditMode)}
      data-block-id={block_id}
      data-initial-query={initialQuery || ''}
      data-initial-deep-research={initialDeepResearch || ''}
      data-initial-chat-session-id={initialChatSessionId || ''}
    >
      ChatWindow
    </div>
  ),
}));

describe('ChatBlockView', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      const id = url.split('/').pop();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id, name: `Persona ${id}` }),
      });
    });
  });

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

  it('passes initialQuery from URL param to ChatWindow', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: { search: '?query=hello+world' },
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-initial-query',
      'hello world',
    );
  });

  it('passes initialDeepResearch from URL param to ChatWindow', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: { search: '?query=test&deepResearch=true' },
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-initial-deep-research',
      'true',
    );
  });

  it('passes initialChatSessionId from URL param to ChatWindow', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: {
        search: '?chat=46277749-db60-44f2-9de1-c5dca2eb68fa',
      },
    };
    render(<ChatBlockView {...props} />);
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-initial-chat-session-id',
      '46277749-db60-44f2-9de1-c5dca2eb68fa',
    );
  });

  it('passes both query and deepResearch params together', () => {
    const props = {
      ...defaultProps,
      assistantData: { id: 42, name: 'My Assistant' },
      location: { search: '?query=my+question&deepResearch=false' },
    };
    render(<ChatBlockView {...props} />);
    const chatWindow = screen.getByTestId('chat-window');
    expect(chatWindow).toHaveAttribute('data-initial-query', 'my question');
    expect(chatWindow).toHaveAttribute('data-initial-deep-research', 'false');
  });
  it('opens on the assistant named by ?assistant= when the editor offers it', async () => {
    const props = {
      ...defaultProps,
      data: { assistant: 34, switchableAssistants: [29] },
      assistantData: { id: 29, name: 'Named Assistant' },
      location: { search: '?assistant=29' },
    };
    render(<ChatBlockView {...props} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-initial-assistant',
      '29',
    );
  });

  it('ignores ?assistant= for an assistant the editor did not offer', async () => {
    const props = {
      ...defaultProps,
      data: { assistant: 34, switchableAssistants: [29] },
      assistantData: { id: 34, name: 'Default Assistant' },
      location: { search: '?assistant=99' },
    };
    render(<ChatBlockView {...props} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-initial-assistant',
      '34',
    );
  });

  it('loads the persona named by ?assistant= as the primary persona', () => {
    superagent.get.mockClear();
    const descriptor = assistantDataDescriptor({
      data: { assistant: 34, switchableAssistants: [29] },
      location: { search: '?assistant=29' },
    });

    expect(superagent.get).toHaveBeenCalledWith('/_da/persona/29');
    expect(descriptor[0]).toBe('assistantData');
    expect(descriptor[2]).toBe('29');
  });

  it('loads the configured default when no assistant is named', () => {
    superagent.get.mockClear();
    const descriptor = assistantDataDescriptor({
      data: { assistant: 34, switchableAssistants: [29] },
      location: { search: '' },
    });

    expect(superagent.get).toHaveBeenCalledWith('/_da/persona/34');
    expect(descriptor[2]).toBe('34');
  });

  it('loads no persona when the block has no default assistant', () => {
    superagent.get.mockClear();
    const descriptor = assistantDataDescriptor({
      data: {},
      location: { search: '?assistant=29' },
    });

    expect(superagent.get).not.toHaveBeenCalled();
    expect(descriptor[1]).toBeNull();
  });

  it('orders the selector options with the default first, then the configured ones', async () => {
    const props = {
      ...defaultProps,
      data: { assistant: 34, switchableAssistants: [29, 17] },
      assistantData: { id: 34, name: 'Default Assistant' },
    };
    render(<ChatBlockView {...props} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const chatWindow = screen.getByTestId('chat-window');
    expect(chatWindow).toHaveAttribute('data-persona-ids', '34,29,17');
  });

  it('fetches no switchable persona in edit mode', async () => {
    superagent.get.mockClear();
    const props = {
      ...defaultProps,
      data: { assistant: 34, switchableAssistants: [29, 17] },
      assistantData: { id: 34, name: 'Default Assistant' },
      isEditMode: true,
    };
    render(<ChatBlockView {...props} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(superagent.get).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat-window')).toHaveAttribute(
      'data-persona-count',
      '1',
    );
  });
});
