import {
  render as rtlRender,
  screen,
  fireEvent,
  act,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import FeedbackModal from '@eeacms/volto-eea-chatbot/ChatBlock/components/FeedbackModal';
import * as lib from '@eeacms/volto-eea-chatbot/ChatBlock/utils';

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/utils');

const render = (ui) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <IntlProvider locale="en">{children}</IntlProvider>
    ),
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FeedbackModal', () => {
  const baseProps = {
    modalOpen: true,
    onClose: jest.fn(),
    setToast: jest.fn(),
    onToast: jest.fn(),
    setIsToastActive: jest.fn(),
    message: { messageId: '1234' },
    feedbackReasons: ['Reason 1', 'Reason 2'],
  };

  it.each([true, false])(
    'prevents duplicate submissions and shows pending progress (positive=%s)',
    async (isPositive) => {
      let resolveRequest;
      lib.createChatMessageFeedback.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );
      render(<FeedbackModal {...baseProps} isPositive={isPositive} />);
      const submit = screen.getByRole('button', { name: 'Submit Feedback' });
      const status = screen.getByRole('status');
      expect(status).toBeEmptyDOMElement();

      // Exercise multiple activations in the same event batch as well as later clicks.
      act(() => {
        fireEvent.click(submit);
        fireEvent.click(submit);
        fireEvent.click(submit);
      });

      expect(lib.createChatMessageFeedback).toHaveBeenCalledTimes(1);
      expect(submit).toBeDisabled();
      // The built-in loading button hides its text; use an inline spinner instead.
      expect(submit).not.toHaveClass('loading');
      const spinner = submit.querySelector('.feedback-submit-spinner');
      expect(spinner).toBeInTheDocument();
      // Generic spinner/icon classes combine the chatbot border and icon glyph.
      for (const className of ['spinner', 'loading', 'icon']) {
        expect(spinner).not.toHaveClass(className);
      }
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
      expect(submit).toHaveAttribute('aria-busy', 'true');
      expect(submit).toHaveAccessibleName('Submitting...');
      expect(
        submit.querySelector('.feedback-submit-progress'),
      ).toHaveTextContent('Submitting...');
      expect(status).toHaveTextContent('Submitting...');
      expect(submit).not.toContainElement(status);
      expect(status.closest('[aria-busy="true"]')).toBeNull();
      expect(status).toHaveClass('feedback-submit-status');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('textbox')).toBeDisabled();
      if (!isPositive) {
        for (const reason of baseProps.feedbackReasons) {
          expect(screen.getByRole('button', { name: reason })).toBeDisabled();
        }
      }
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.keyDown(document, { key: 'Escape', keyCode: 27 });
      fireEvent.click(document.querySelector('.ui.dimmer'));
      expect(baseProps.onToast).not.toHaveBeenCalled();
      expect(baseProps.onClose).not.toHaveBeenCalled();

      fireEvent.click(submit);
      expect(lib.createChatMessageFeedback).toHaveBeenCalledTimes(1);
      await act(async () => resolveRequest({}));

      expect(baseProps.onToast).toHaveBeenCalledTimes(1);
      expect(baseProps.onToast).toHaveBeenCalledWith(
        'Thanks for your feedback!',
        'success',
      );
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
      expect(submit).not.toBeDisabled();
      expect(submit.querySelector('.loading.icon')).not.toBeInTheDocument();
      expect(submit).toHaveAccessibleName('Submit Feedback');
      expect(status).toBeEmptyDOMElement();
    },
  );

  it('submits positive feedback successfully', async () => {
    lib.createChatMessageFeedback.mockResolvedValue({});

    render(<FeedbackModal {...baseProps} isPositive={true} />);

    fireEvent.change(
      screen.getByPlaceholderText(/What did you like about this response/i),
      { target: { value: 'Great response!' } },
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Submit Feedback'));
    });

    expect(lib.createChatMessageFeedback).toHaveBeenCalledWith({
      chat_message_id: '1234',
      feedback_text: 'Great response!',
      is_positive: true,
      predefined_feedback: '',
    });
    expect(baseProps.onToast).toHaveBeenCalledWith(
      'Thanks for your feedback!',
      'success',
    );
    expect(baseProps.setIsToastActive).toHaveBeenCalledWith(true);
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('submits negative feedback with selected reason', async () => {
    lib.createChatMessageFeedback.mockResolvedValue({});

    render(<FeedbackModal {...baseProps} isPositive={false} />);

    const reasonBtn = screen.getByRole('button', { name: 'Reason 1' });
    fireEvent.click(reasonBtn);
    expect(reasonBtn.classList.contains('primary')).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/What could be improved/i), {
      target: { value: 'Needs more details' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Submit Feedback'));
    });

    expect(lib.createChatMessageFeedback).toHaveBeenCalledWith({
      chat_message_id: '1234',
      feedback_text: 'Needs more details',
      is_positive: false,
      predefined_feedback: 'Reason 1',
    });
    expect(baseProps.onToast).toHaveBeenCalledWith(
      'Thanks for your feedback!',
      'success',
    );
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('handles submission failure', async () => {
    lib.createChatMessageFeedback.mockRejectedValue(new Error('fail'));

    render(<FeedbackModal {...baseProps} isPositive={true} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Submit Feedback'));
    });

    expect(baseProps.onToast).toHaveBeenCalledWith(
      'Failed to submit feedback.',
      'error',
    );
    expect(baseProps.setIsToastActive).toHaveBeenCalledWith(true);
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('clears pending state on failure and permits a new submission after reopening', async () => {
    let rejectRequest;
    lib.createChatMessageFeedback.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    const { rerender } = render(
      <FeedbackModal {...baseProps} isPositive={true} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    await act(async () =>
      rejectRequest(new Error('feedback service unavailable')),
    );

    expect(baseProps.onToast).toHaveBeenCalledTimes(1);
    expect(baseProps.onToast).toHaveBeenCalledWith(
      'Failed to submit feedback.',
      'error',
    );
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(
      screen.getByRole('button', { name: 'Submit Feedback' }),
    ).not.toBeDisabled();

    rerender(
      <FeedbackModal {...baseProps} isPositive={true} modalOpen={false} />,
    );
    rerender(<FeedbackModal {...baseProps} isPositive={true} />);
    lib.createChatMessageFeedback.mockResolvedValueOnce({});
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' })),
    );

    expect(lib.createChatMessageFeedback).toHaveBeenCalledTimes(2);
    expect(baseProps.onToast).toHaveBeenCalledTimes(2);
    expect(baseProps.onToast).toHaveBeenLastCalledWith(
      'Thanks for your feedback!',
      'success',
    );
    expect(baseProps.onClose).toHaveBeenCalledTimes(2);
  });

  it('resets and closes modal on Cancel click', () => {
    render(<FeedbackModal {...baseProps} isPositive={true} />);

    const textarea = screen.getByPlaceholderText(
      /What did you like about this response/i,
    );
    fireEvent.change(textarea, { target: { value: 'Some feedback' } });
    expect(textarea.value).toBe('Some feedback');

    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('toggles reason button selected state on click', () => {
    render(<FeedbackModal {...baseProps} isPositive={false} />);

    const reason1 = screen.getByRole('button', { name: 'Reason 1' });
    const reason2 = screen.getByRole('button', { name: 'Reason 2' });

    expect(reason1.classList.contains('inverted')).toBe(true);
    expect(reason2.classList.contains('inverted')).toBe(true);

    fireEvent.click(reason1);
    expect(reason1.classList.contains('inverted')).toBe(false);
    expect(reason2.classList.contains('inverted')).toBe(true);

    fireEvent.click(reason2);
    expect(reason1.classList.contains('inverted')).toBe(true);
    expect(reason2.classList.contains('inverted')).toBe(false);
  });

  it('updates textarea value on user input', () => {
    render(<FeedbackModal {...baseProps} isPositive={true} />);

    const textarea = screen.getByPlaceholderText(
      /What did you like about this response/i,
    );
    fireEvent.change(textarea, { target: { value: 'Awesome!' } });
    expect(textarea.value).toBe('Awesome!');
  });
});
