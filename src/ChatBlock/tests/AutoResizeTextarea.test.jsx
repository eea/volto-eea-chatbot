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

  it('renders stop button during streaming when enableStopButton is true', () => {
    const mockCancel = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        isStreaming={true}
        enableStopButton={true}
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

  it('renders disabled send button during streaming when enableStopButton is false', () => {
    const { getByLabelText, queryByLabelText } = render(
      <AutoResizeTextarea
        onSubmit={jest.fn()}
        isStreaming={true}
        enableStopButton={false}
      />,
    );

    expect(queryByLabelText('Stop generating')).not.toBeInTheDocument();
    const sendButton = getByLabelText('Send');
    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });
});
