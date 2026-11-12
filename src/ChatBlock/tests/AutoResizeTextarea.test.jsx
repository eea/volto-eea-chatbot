import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoResizeTextarea from '@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea';
import { trackEvent } from '@eeacms/volto-matomo/utils';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }) => defaultMessage }),
  defineMessages: (msgs) => msgs,
  FormattedMessage: ({ defaultMessage }) => <span>{defaultMessage}</span>,
}));

jest.mock('@eeacms/volto-matomo/utils', () => ({
  trackEvent: jest.fn(),
}));

describe('AutoResizeTextarea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders textarea and button', () => {
    const { getByRole, getByLabelText } = render(
      <AutoResizeTextarea onSubmit={jest.fn()} />,
    );

    expect(getByRole('textbox')).toBeInTheDocument();
    expect(getByLabelText('Send')).toBeInTheDocument();
  });

  it('calls onSubmit with input text on Enter key press', () => {
    const mockSubmit = jest.fn();
    const { getByRole } = render(<AutoResizeTextarea onSubmit={mockSubmit} />);
    const textarea = getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(mockSubmit).toHaveBeenCalledWith({ message: 'Hello' });
  });

  it('does not call onSubmit if input is empty', () => {
    const mockSubmit = jest.fn();
    const { getByRole } = render(<AutoResizeTextarea onSubmit={mockSubmit} />);
    const textarea = getByRole('textbox');

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('adds newline on Shift+Enter', () => {
    const { getByRole } = render(<AutoResizeTextarea onSubmit={jest.fn()} />);
    const textarea = getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(textarea.value).toBe('Line 1\n');
  });

  it('renders stop button during streaming when stopButton is input', () => {
    const mockCancel = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        isStreaming={true}
        stopButton="input"
        enableMatomoTracking={true}
        onCancel={mockCancel}
      />,
    );

    expect(getByLabelText('Stop generating')).toBeInTheDocument();
    expect(queryByLabelText('Send')).not.toBeInTheDocument();

    fireEvent.click(getByLabelText('Stop generating'));
    expect(mockCancel).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Chatbot: Stop generating',
      }),
    );
  });

  it('renders disabled send button during streaming when stopButton is disabled or non-input', () => {
    const { getByLabelText, queryByLabelText, rerender } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        isStreaming={true}
        stopButton="disabled"
      />,
    );

    expect(queryByLabelText('Stop generating')).not.toBeInTheDocument();
    expect(getByLabelText('Send')).toBeDisabled();

    rerender(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        isStreaming={true}
        stopButton="floating"
      />,
    );
    expect(queryByLabelText('Stop generating')).not.toBeInTheDocument();
    expect(getByLabelText('Send')).toBeDisabled();
  });

  it('renders no-toolbar class and reclaims toolbar space when toolbarLeft is empty or falsy', () => {
    const { container, rerender } = render(
      <AutoResizeTextarea onSubmit={jest.fn()} />,
    );

    expect(container.querySelector('.chat-composer')).toHaveClass('no-toolbar');
    expect(
      container.querySelector('.chat-composer-toolbar'),
    ).not.toBeInTheDocument();

    rerender(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        toolbarLeft={
          <>
            {false && <div />}
            {null}
          </>
        }
      />,
    );
    expect(container.querySelector('.chat-composer')).toHaveClass('no-toolbar');
    expect(
      container.querySelector('.chat-composer-toolbar'),
    ).not.toBeInTheDocument();
  });

  it('renders has-toolbar class and toolbar row when toolbarLeft contains elements', () => {
    const { container } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        toolbarLeft={
          <>
            <button type="button">Tool</button>
          </>
        }
      />,
    );

    expect(container.querySelector('.chat-composer')).toHaveClass(
      'has-toolbar',
    );
    expect(
      container.querySelector('.chat-composer-toolbar'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.chat-composer-toolbar-left'),
    ).toHaveTextContent('Tool');
  });

  it('renders toolbarRight inside actions container alongside submit button', () => {
    const { getByTestId } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        toolbarRight={
          <button data-testid="custom-action" type="button">
            Action
          </button>
        }
      />,
    );
    expect(getByTestId('custom-action')).toBeInTheDocument();
  });

  it('surfaces floating MCP tool proposal on matching keyword and replaces the trigger text on click', () => {
    const mockEnableTool = jest.fn();
    const mockTools = [
      {
        id: 1,
        name: 'internal_search',
        display_name: 'Internal Search',
        in_code_tool_id: 'SearchTool',
      },
      {
        id: 10,
        name: 'data_connector',
        display_name: 'EEA Data Connector',
        description: 'Query EEA datasets',
        mcp_server_id: 1,
      },
    ];

    const { getByRole, getByText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        availableTools={mockTools}
        selectedToolIds={[1]}
        onEnableTool={mockEnableTool}
        enableMatomoTracking={true}
      />,
    );

    const textarea = getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Show me data on water' } });

    // Proposal should appear floating above the textarea
    expect(getByText('@EEA Data Connector')).toBeInTheDocument();
    expect(getByText('Use')).toBeInTheDocument();

    // Clicking proposal
    fireEvent.click(
      getByRole('button', { name: /Enable @EEA Data Connector/i }),
    );

    expect(mockEnableTool).toHaveBeenCalledWith(10);
    // The typed word "data" is replaced with "@EEA Data Connector"
    expect(textarea.value).toBe('Show me @EEA Data Connector on water');
    expect(trackEvent).toHaveBeenCalledWith({
      category: 'Chatbot',
      action: 'MCP tool selected',
      name: 'EEA Data Connector',
    });
  });

  it('replaces trigger keyword at the end of the input', () => {
    const mockEnableTool = jest.fn();
    const mockTools = [
      {
        id: 2,
        name: 'image_generation',
        display_name: 'Image Generation',
      },
    ];

    const { getByRole, getByText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        availableTools={mockTools}
        selectedToolIds={[]}
        onEnableTool={mockEnableTool}
      />,
    );

    const textarea = getByRole('textbox');
    fireEvent.change(textarea, {
      target: {
        value: 'Which species are most at risk in Europe? image',
      },
    });

    expect(getByText('@Image Generation')).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /Enable @Image Generation/i }));

    expect(mockEnableTool).toHaveBeenCalledWith(2);
    // "image" at the end is replaced with "@Image Generation "
    expect(textarea.value).toBe(
      'Which species are most at risk in Europe? @Image Generation ',
    );
  });

  it('allows dismissing the floating tool proposal', () => {
    const mockTools = [
      {
        id: 10,
        name: 'data_connector',
        display_name: 'EEA Data Connector',
        mcp_server_id: 1,
      },
    ];

    const { getByRole, getByText, queryByText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        availableTools={mockTools}
        selectedToolIds={[]}
      />,
    );

    const textarea = getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'emissions data' } });

    expect(getByText('@EEA Data Connector')).toBeInTheDocument();

    const dismissBtn = getByRole('button', { name: /Dismiss suggestion/i });
    fireEvent.click(dismissBtn);

    expect(queryByText('@EEA Data Connector')).not.toBeInTheDocument();
  });
});
