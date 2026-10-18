import React, { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import { Modal, Button, TextArea, Form, Icon } from 'semantic-ui-react';
import { createChatMessageFeedback } from '@eeacms/volto-eea-chatbot/ChatBlock/utils';

const messages = defineMessages({
  submit: {
    id: 'Submit Feedback',
    defaultMessage: 'Submit Feedback',
  },
  submitting: {
    id: 'Submitting...',
    defaultMessage: 'Submitting...',
  },
});

const FeedbackModal = ({
  modalOpen,
  onClose,
  setToast,
  onToast,
  isPositive,
  message,
  setIsToastActive,
  feedbackReasons,
  enableMatomoTracking,
  persona,
}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const isPositiveFeedback = isPositive;
  const intl = useIntl();
  const submitLabel = intl.formatMessage(messages.submit);
  const submittingLabel = intl.formatMessage(messages.submitting);

  const resetForm = () => {
    setFeedbackText('');
    setSelectedReason('');
  };

  const handleClose = () => {
    if (submissionInFlight.current) return;
    resetForm();
    onClose();
  };

  const submitFeedback = async () => {
    // Lock synchronously: another activation can arrive before React renders
    // the disabled button, so state alone is not a submission guard.
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setIsSubmitting(true);
    try {
      await createChatMessageFeedback({
        chat_message_id: message.messageId,
        feedback_text: feedbackText,
        is_positive: isPositive,
        predefined_feedback: selectedReason,
      });
      if (enableMatomoTracking) {
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: isPositive
            ? 'Chatbot: Positive feedback submitted'
            : 'Chatbot: Negative feedback submitted',
          name: 'Feedback submitted',
        });
      }
      setIsToastActive(true);
      onToast('Thanks for your feedback!', 'success');
    } catch (error) {
      setIsToastActive(true);
      onToast('Failed to submit feedback.', 'error');
    } finally {
      setTimeout(() => setIsToastActive(false), 5000);
      setTimeout(() => setToast(null), 3500);
      submissionInFlight.current = false;
      setIsSubmitting(false);
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      open={modalOpen}
      onClose={handleClose}
      closeOnDimmerClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
      className="feedback-modal"
      size="small"
    >
      <Modal.Header>
        <h3>
          {isPositiveFeedback ? (
            <>
              <Icon name="thumbs up outline" />
              Share your positive feedback
            </>
          ) : (
            <>
              <Icon name="thumbs down outline" />
              Tell us how we can improve
            </>
          )}
        </h3>
      </Modal.Header>

      <Modal.Content>
        {!isPositiveFeedback && (
          <div className="reason-buttons">
            {feedbackReasons?.map((reason) => (
              <Button
                primary
                size="small"
                key={reason}
                disabled={isSubmitting}
                onClick={() => setSelectedReason(reason)}
                inverted={selectedReason !== reason}
              >
                {reason}
              </Button>
            ))}
          </div>
        )}

        <Form>
          <TextArea
            disabled={isSubmitting}
            placeholder={
              isPositiveFeedback
                ? 'What did you like about this response? (Optional)'
                : 'What could be improved? (Optional)'
            }
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
        </Form>
      </Modal.Content>

      <Modal.Actions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          primary
          className="feedback-submit-button"
          onClick={submitFeedback}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          aria-label={isSubmitting ? submittingLabel : submitLabel}
        >
          <span className="feedback-submit-label" aria-hidden={isSubmitting}>
            {submitLabel}
          </span>
          <span
            className="feedback-submit-progress"
            aria-hidden={!isSubmitting}
          >
            <span className="feedback-submit-spinner" aria-hidden="true" />
            {submittingLabel}
          </span>
        </Button>
        <span className="feedback-submit-status" role="status">
          {isSubmitting ? submittingLabel : ''}
        </span>
      </Modal.Actions>
    </Modal>
  );
};

export default FeedbackModal;
