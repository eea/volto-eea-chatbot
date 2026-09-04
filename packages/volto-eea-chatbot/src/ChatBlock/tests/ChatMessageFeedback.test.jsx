import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessageFeedback from '@eeacms/volto-eea-chatbot/ChatBlock/components/ChatMessageFeedback';

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/FeedbackModal', () => ({
  default: (props) => {
    const { modalOpen, onClose, onToast } = props;

    return modalOpen ? (
      <div data-testid="feedback-modal">
        Modal Open
        <button
          onClick={() => {
            onToast('Thank you for your feedback!', 'success');
            onClose();
          }}
        >
          Submit Feedback
        </button>
      </div>
    ) : null;
  },
}));

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => ({
  default: ({ name }) => <img src={name} alt="icon" />,
}));

vi.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/markdown', () => ({
  SVGIcon: ({ name }) => <img src={name} alt="icon" />,
}));

vi.mock('@eeacms/volto-eea-chatbot/icons/thumbs-up.svg', () => ({
  default: 'thumbs-up.svg',
}));
vi.mock('@eeacms/volto-eea-chatbot/icons/thumbs-down.svg', () => ({
  default: 'thumbs-down.svg',
}));

describe('ChatMessageFeedback', () => {
  const defaultProps = {
    message: {
      messageId: 1,
      message: 'Test message',
      type: 'assistant',
    },
    feedbackReasons: ['Reason 1', 'Reason 2'],
  };

  it('renders Like and Dislike buttons', () => {
    render(<ChatMessageFeedback {...defaultProps} />);
    expect(screen.getByLabelText('Like')).toBeInTheDocument();
    expect(screen.getByLabelText('Dislike')).toBeInTheDocument();
  });

  it('opens modal when Like is clicked', () => {
    render(<ChatMessageFeedback {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Like'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
  });

  it('opens modal when Dislike is clicked', () => {
    render(<ChatMessageFeedback {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Dislike'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
  });

  it('shows toast after submitting feedback in modal', () => {
    render(<ChatMessageFeedback {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Like'));

    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);

    expect(
      screen.getByText('Thank you for your feedback!'),
    ).toBeInTheDocument();
  });
});
