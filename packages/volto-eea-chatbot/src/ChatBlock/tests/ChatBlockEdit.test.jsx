import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/hocs/withOnyxData', () => {
  return { default: (_callback) => (Component) => Component };
});

vi.mock('superagent', () => ({
  get: vi.fn().mockReturnValue({ type: vi.fn().mockReturnThis() }),
}));

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/ChatBlockView', () => ({
  __esModule: true,
  default: ({ isEditMode }) => (
    <div data-testid="chat-block-view" data-edit-mode={String(isEditMode)}>
      ChatBlockView
    </div>
  ),
}));

vi.mock('@plone/volto/components/manage/Sidebar/SidebarPortal', () => ({
  __esModule: true,
  default: ({ selected, children }) =>
    selected ? <div data-testid="sidebar-portal">{children}</div> : null,
}));

vi.mock('@plone/volto/components/manage/Form/BlockDataForm', () => ({
  __esModule: true,
  default: ({ title }) => <div data-testid="block-data-form">{title}</div>,
}));

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/schema', () => ({
  ChatBlockSchema: vi.fn(() => ({
    title: 'AI Chatbot',
    properties: {},
    fieldsets: [{ id: 'default', title: 'Default', fields: [] }],
    required: [],
  })),
}));

// Import after mocks
const ChatBlockEdit = (
  await import('@eeacms/volto-eea-chatbot/ChatBlock/ChatBlockEdit')
).default;

describe('ChatBlockEdit', () => {
  const defaultProps = {
    block: 'block-uuid-1',
    data: { assistant: 1 },
    onChangeBlock: vi.fn(),
    selected: false,
    assistants: [{ id: 1, name: 'Assistant 1' }],
  };

  it('renders ChatBlockView in edit mode', () => {
    render(<ChatBlockEdit {...defaultProps} />);
    expect(screen.getByTestId('chat-block-view')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-view')).toHaveAttribute(
      'data-edit-mode',
      'true',
    );
  });

  it('does not show sidebar when not selected', () => {
    render(<ChatBlockEdit {...defaultProps} selected={false} />);
    expect(screen.queryByTestId('sidebar-portal')).not.toBeInTheDocument();
  });

  it('shows sidebar with BlockDataForm when selected', () => {
    render(<ChatBlockEdit {...defaultProps} selected={true} />);
    expect(screen.getByTestId('sidebar-portal')).toBeInTheDocument();
    expect(screen.getByTestId('block-data-form')).toBeInTheDocument();
  });

  it('shows schema title in BlockDataForm', () => {
    render(<ChatBlockEdit {...defaultProps} selected={true} />);
    expect(screen.getByText('AI Chatbot')).toBeInTheDocument();
  });
});
