import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import SpeakButton from '../components/SpeakButton';
import { resetSpeechSynthesisStore } from '../hooks/useSpeechSynthesis';

class FakeUtterance {
  lang = '';
  pitch = 1;
  rate = 1;
  text: string;
  voice: any = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSpeechSynthesis {
  spoken: FakeUtterance[] = [];
  cancel = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  speak = jest.fn((utterance: FakeUtterance) => {
    this.spoken.push(utterance);
  });
  getVoices = jest.fn(() => []);
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

let synthesis: FakeSpeechSynthesis;

const renderWithIntl = (component) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );

describe('SpeakButton', () => {
  beforeEach(() => {
    resetSpeechSynthesisStore();
    synthesis = new FakeSpeechSynthesis();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: synthesis,
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      writable: true,
      value: FakeUtterance,
    });
  });

  afterEach(() => {
    delete (window as any).speechSynthesis;
    delete (window as any).SpeechSynthesisUtterance;
    resetSpeechSynthesisStore();
  });

  it('renders nothing without browser support', () => {
    delete (window as any).speechSynthesis;
    const { container } = renderWithIntl(<SpeakButton text="Hello" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the answer has no speakable text', () => {
    const { container } = renderWithIntl(<SpeakButton text="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reads the answer as plain text', () => {
    renderWithIntl(<SpeakButton text={'## Air quality\n\nImproved **a lot** [1].'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Read answer aloud' }));

    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(synthesis.spoken[0].text).toBe('Air quality Improved a lot.');
    expect(synthesis.spoken[0].lang).toBe('en-US');
  });

  it('toggles between playing and stopped states', () => {
    renderWithIntl(<SpeakButton text="Hello" lang="ro" />);

    fireEvent.click(screen.getByRole('button', { name: 'Read answer aloud' }));

    const stopButton = screen.getByRole('button', { name: 'Stop reading' });
    expect(stopButton).toHaveAttribute('aria-pressed', 'true');
    expect(synthesis.spoken[0].lang).toBe('ro-RO');

    fireEvent.click(stopButton);
    expect(synthesis.cancel).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Read answer aloud' }),
    ).toBeInTheDocument();
  });

  it('returns to the idle label when playback ends', () => {
    renderWithIntl(<SpeakButton text="Hello" />);

    fireEvent.click(screen.getByRole('button', { name: 'Read answer aloud' }));
    act(() => synthesis.spoken[0].onend?.());

    expect(
      screen.getByRole('button', { name: 'Read answer aloud' }),
    ).toBeInTheDocument();
  });

  it('is disabled while the answer is streaming', () => {
    renderWithIntl(<SpeakButton text="Hello" disabled={true} />);
    expect(
      screen.getByRole('button', { name: 'Read answer aloud' }),
    ).toBeDisabled();
  });
});
