import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import MicButton from '../components/MicButton';

const renderWithIntl = (component) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );

describe('MicButton', () => {
  it('renders an inactive mic toggle', () => {
    renderWithIntl(
      <MicButton isListening={false} onStart={jest.fn()} onStop={jest.fn()} />,
    );

    const button = screen.getByRole('button', { name: 'Start voice input' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveClass('listening');
  });

  it('shows a listening state with a pulsing halo', () => {
    renderWithIntl(
      <MicButton isListening={true} onStart={jest.fn()} onStop={jest.fn()} />,
    );

    const button = screen.getByRole('button', { name: 'Stop voice input' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('listening');
    expect(button.querySelector('.mic-halo')).toBeInTheDocument();
  });

  it('does not render the halo when idle', () => {
    renderWithIntl(
      <MicButton isListening={false} onStart={jest.fn()} onStop={jest.fn()} />,
    );

    const button = screen.getByRole('button', { name: 'Start voice input' });
    expect(button.querySelector('.mic-halo')).toBeNull();
  });

  it('starts listening on click', () => {
    const onStart = jest.fn();
    renderWithIntl(
      <MicButton isListening={false} onStart={onStart} onStop={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('stops listening on click while listening', () => {
    const onStop = jest.fn();
    renderWithIntl(
      <MicButton isListening={true} onStart={jest.fn()} onStop={onStop} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('is disabled while the answer is streaming', () => {
    const onStart = jest.fn();
    renderWithIntl(
      <MicButton
        isListening={false}
        onStart={onStart}
        onStop={jest.fn()}
        disabled={true}
      />,
    );

    const button = screen.getByRole('button', { name: 'Start voice input' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onStart).not.toHaveBeenCalled();
  });
});
