import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { ChatExportDropdown } from '@eeacms/volto-eea-chatbot/ChatBlock/components/ChatExportDropdown';
import * as exportUtils from '@eeacms/volto-eea-chatbot/ChatBlock/utils/exportUtils';

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => {
  return function MockIcon() {
    return <span data-testid="mock-icon" />;
  };
});

describe('ChatExportDropdown', () => {
  const mockPersona = { id: 1, name: 'Green Guru' };
  const mockMessages = [
    {
      messageId: 1,
      nodeId: 1,
      message: 'Hello',
      type: 'user',
      files: [],
      toolCall: null,
      parentNodeId: null,
      packets: [],
    },
    {
      messageId: 2,
      nodeId: 2,
      message: 'Hi there!',
      type: 'assistant',
      files: [],
      toolCall: null,
      parentNodeId: 1,
      packets: [],
    },
  ];

  const renderComponent = (props = {}) => {
    return render(
      <IntlProvider locale="en" messages={{}}>
        <ChatExportDropdown
          messages={mockMessages}
          persona={mockPersona}
          {...props}
        />
      </IntlProvider>,
    );
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders trigger button', () => {
    renderComponent();
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('does not render trigger when messages array is empty by default', () => {
    renderComponent({ messages: [] });
    expect(
      screen.queryByRole('button', { name: /export/i }),
    ).not.toBeInTheDocument();
  });

  it('disables trigger when messages array is empty and hideWhenEmpty is false', () => {
    renderComponent({ messages: [], hideWhenEmpty: false });
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeDisabled();
  });

  it('disables trigger when disabled prop is true', () => {
    renderComponent({ disabled: true });
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeDisabled();
  });

  it('opens dropdown menu on click', () => {
    renderComponent();
    const button = screen.getByRole('button', { name: /export/i });
    fireEvent.click(button);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('Word (.docx)')).toBeInTheDocument();
    expect(screen.getByText('PDF (.pdf)')).toBeInTheDocument();
  });

  it('calls exportConversationAsMarkdown when clicking Markdown option', () => {
    const exportMdSpy = jest
      .spyOn(exportUtils, 'exportConversationAsMarkdown')
      .mockImplementation(() => {});

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    const mdBtn = screen.getByText('Markdown (.md)');
    fireEvent.click(mdBtn);

    expect(exportMdSpy).toHaveBeenCalledWith(mockMessages, mockPersona);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    exportMdSpy.mockRestore();
  });

  it('calls exportConversationAsPdf when clicking PDF option', () => {
    const exportPdfSpy = jest
      .spyOn(exportUtils, 'exportConversationAsPdf')
      .mockImplementation(() => {});

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    const pdfBtn = screen.getByText('PDF (.pdf)');
    fireEvent.click(pdfBtn);

    expect(exportPdfSpy).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    exportPdfSpy.mockRestore();
  });

  it('calls exportConversationAsDocx when clicking DOCX option', async () => {
    const exportDocxSpy = jest
      .spyOn(exportUtils, 'exportConversationAsDocx')
      .mockImplementation(() => Promise.resolve());

    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));

    const docxBtn = screen.getByText('Word (.docx)');
    fireEvent.click(docxBtn);

    await waitFor(() => {
      expect(exportDocxSpy).toHaveBeenCalledWith(
        mockMessages,
        mockPersona,
        expect.anything(),
      );
    });

    exportDocxSpy.mockRestore();
  });

  it('closes dropdown when pressing Escape', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
