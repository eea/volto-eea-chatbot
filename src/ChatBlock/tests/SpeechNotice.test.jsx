import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import SpeechNotice, {
  getSpeechErrorMessage,
} from '../components/SpeechNotice';

const renderWithIntl = (component) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );

describe('SpeechNotice', () => {
  it('renders nothing without an error or disclosure', () => {
    const { container } = renderWithIntl(<SpeechNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the mic usage disclosure and dismisses it', () => {
    const onDismissPrivacyNote = jest.fn();
    renderWithIntl(
      <SpeechNotice
        showPrivacyNote={true}
        onDismissPrivacyNote={onDismissPrivacyNote}
      />,
    );

    expect(
      screen.getByText(
        'Audio is processed by your browser’s speech service and is not stored by EEA.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissPrivacyNote).toHaveBeenCalledTimes(1);
  });

  it('shows a permission error with a dismiss control', () => {
    const onDismissError = jest.fn();
    renderWithIntl(
      <SpeechNotice error="not-allowed" onDismissError={onDismissError} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Microphone access was blocked. Allow the microphone in your browser settings and try again.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it('maps known error codes and falls back to a generic message', () => {
    expect(getSpeechErrorMessage('audio-capture').id).toBe(
      'No microphone was found. Connect a microphone and try again.',
    );
    expect(getSpeechErrorMessage('insecure-context').id).toBe(
      'Voice input requires a secure (HTTPS) connection.',
    );
    expect(getSpeechErrorMessage('something-new').id).toBe(
      'Voice input failed. Please try again or type your question.',
    );
    expect(getSpeechErrorMessage().id).toBe(
      'Voice input failed. Please try again or type your question.',
    );
  });
});
