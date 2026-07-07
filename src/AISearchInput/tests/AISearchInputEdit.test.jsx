import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AISearchInputEdit from '@eeacms/volto-eea-chatbot/AISearchInput/AISearchInputEdit';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }) => defaultMessage,
  }),
}));

jest.mock('@eeacms/volto-eea-chatbot/AISearchInput/AISearchInputView', () => ({
  __esModule: true,
  default: ({ isEditMode }) => (
    <div data-testid="aisearch-input-view" data-edit-mode={String(isEditMode)}>
      AISearchInputView
    </div>
  ),
}));

jest.mock('@plone/volto/components/manage/Sidebar/SidebarPortal', () => ({
  __esModule: true,
  default: ({ selected, children }) =>
    selected ? <div data-testid="sidebar-portal">{children}</div> : null,
}));

jest.mock('@plone/volto/components/manage/Form/BlockDataForm', () => ({
  __esModule: true,
  default: ({ title }) => <div data-testid="block-data-form">{title}</div>,
}));

jest.mock('@eeacms/volto-eea-chatbot/AISearchInput/schema', () => ({
  AISearchInputSchema: jest.fn(() => ({
    title: 'AI Search Input',
    properties: {},
    fieldsets: [{ id: 'default', title: 'Default', fields: [] }],
    required: [],
  })),
}));

// Mock styles
jest.mock('@eeacms/volto-eea-chatbot/AISearchInput/styles.less', () => ({}));

describe('AISearchInputEdit', () => {
  const defaultProps = {
    block: 'block-uuid-1',
    data: {},
    onChangeBlock: jest.fn(),
    selected: false,
  };

  it('renders view in edit mode', () => {
    render(<AISearchInputEdit {...defaultProps} />);
    expect(screen.getByTestId('aisearch-input-view')).toBeInTheDocument();
    expect(screen.getByTestId('aisearch-input-view')).toHaveAttribute(
      'data-edit-mode',
      'true',
    );
  });

  it('does not show sidebar when not selected', () => {
    render(<AISearchInputEdit {...defaultProps} selected={false} />);
    expect(screen.queryByTestId('sidebar-portal')).not.toBeInTheDocument();
  });

  it('shows sidebar with BlockDataForm when selected', () => {
    render(<AISearchInputEdit {...defaultProps} selected={true} />);
    expect(screen.getByTestId('sidebar-portal')).toBeInTheDocument();
    expect(screen.getByTestId('block-data-form')).toBeInTheDocument();
  });

  it('shows schema title in BlockDataForm', () => {
    render(<AISearchInputEdit {...defaultProps} selected={true} />);
    expect(screen.getByText('AI Search Input')).toBeInTheDocument();
  });
});
