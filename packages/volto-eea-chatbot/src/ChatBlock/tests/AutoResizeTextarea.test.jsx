import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoResizeTextarea from '@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea';
import { trackEvent } from '@eeacms/volto-matomo/utils';

vi.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }) => defaultMessage }),
  defineMessages: (msgs) => msgs,
  FormattedMessage: ({ defaultMessage }) => <span>{defaultMessage}</span>,
}));

vi.mock('@eeacms/volto-matomo/utils', () => ({
  trackEvent: vi.fn(),
}));

describe('AutoResizeTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and button', () => {
    const { getByRole, getByLabelText } = render(
      <AutoResizeTextarea onSubmit={vi.fn()} />,
    );

    expect(getByRole('textbox')).toBeInTheDocument();
    expect(getByLabelText('Send')).toBeInTheDocument();
  });

  it('calls onSubmit with input text on Enter key press', () => {
    const mockSubmit = vi.fn();
    const { getByRole } = render(<AutoResizeTextarea onSubmit={mockSubmit} />);
    const textarea = getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(mockSubmit).toHaveBeenCalledWith({ message: 'Hello' });
  });

  it('does not call onSubmit if input is empty', () => {
    const mockSubmit = vi.fn();
    const { getByRole } = render(<AutoResizeTextarea onSubmit={mockSubmit} />);
    const textarea = getByRole('textbox');

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('adds newline on Shift+Enter', () => {
    const { getByRole } = render(<AutoResizeTextarea onSubmit={vi.fn()} />);
    const textarea = getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(textarea.value).toBe('Line 1\n');
  });

  it('renders stop button during streaming when stopButton is input', () => {
    const mockCancel = vi.fn();
    const { getByLabelText, queryByLabelText } = render(
      <AutoResizeTextarea
        onSubmit={vi.fn()}
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
        onSubmit={vi.fn()}
        isStreaming={true}
        stopButton="disabled"
      />,
    );

    expect(queryByLabelText('Stop generating')).not.toBeInTheDocument();
    expect(getByLabelText('Send')).toBeDisabled();

    rerender(
      <AutoResizeTextarea
        onSubmit={vi.fn()}
        isStreaming={true}
        stopButton="floating"
      />,
    );
    expect(queryByLabelText('Stop generating')).not.toBeInTheDocument();
    expect(getByLabelText('Send')).toBeDisabled();
  });
});
