import { act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  loadVoices,
  pickVoice,
  resetSpeechSynthesisStore,
  speakText,
  stopSpeaking,
  useSpeechSynthesis,
} from '../hooks/useSpeechSynthesis';

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
  static last: FakeSpeechSynthesis | null = null;

  spoken: FakeUtterance[] = [];
  cancel = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  voices: any[] = [];
  listeners: Record<string, Array<() => void>> = {};
  speak = jest.fn((utterance: FakeUtterance) => {
    this.spoken.push(utterance);
  });
  getVoices = jest.fn(() => this.voices);
  addEventListener = jest.fn((type: string, listener: () => void) => {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener];
  });
  removeEventListener = jest.fn();

  constructor() {
    FakeSpeechSynthesis.last = this;
  }
}

const installSpeechSynthesis = () => {
  const synthesis = new FakeSpeechSynthesis();
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
  return synthesis;
};

const uninstallSpeechSynthesis = () => {
  delete (window as any).speechSynthesis;
  delete (window as any).SpeechSynthesisUtterance;
  delete (window as any).SpeechRecognition;
};

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    resetSpeechSynthesisStore();
  });

  afterEach(() => {
    uninstallSpeechSynthesis();
    resetSpeechSynthesisStore();
  });

  it('reports unsupported when the browser has no speech synthesis', () => {
    const { result } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello' }),
    );
    expect(result.current.isSupported).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('speaks the text with the resolved language', () => {
    const synthesis = installSpeechSynthesis();
    const { result } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello world', lang: 'ro' }),
    );

    act(() => result.current.toggle());

    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(synthesis.spoken[0].text).toBe('Hello world');
    expect(synthesis.spoken[0].lang).toBe('ro-RO');
    expect(result.current.isSpeaking).toBe(true);
  });

  it('stops playback on a second toggle', () => {
    const synthesis = installSpeechSynthesis();
    const { result } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello world' }),
    );

    act(() => result.current.toggle());
    act(() => result.current.toggle());

    expect(synthesis.cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('only reports the owner of the active playback as speaking', () => {
    installSpeechSynthesis();
    const first = renderHook(() =>
      useSpeechSynthesis({ id: 'first', text: 'One' }),
    );
    const second = renderHook(() =>
      useSpeechSynthesis({ id: 'second', text: 'Two' }),
    );

    act(() => first.result.current.toggle());
    expect(first.result.current.isSpeaking).toBe(true);
    expect(second.result.current.isSpeaking).toBe(false);

    act(() => second.result.current.toggle());
    expect(second.result.current.isSpeaking).toBe(true);
    expect(first.result.current.isSpeaking).toBe(false);
  });

  it('clears speaking state when playback ends', () => {
    const synthesis = installSpeechSynthesis();
    const { result } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello' }),
    );

    act(() => result.current.toggle());
    act(() => synthesis.spoken[0].onend?.());

    expect(result.current.isSpeaking).toBe(false);
  });

  it('exposes the error of the owning playback', () => {
    const synthesis = installSpeechSynthesis();
    const { result } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello' }),
    );

    act(() => result.current.toggle());
    act(() => synthesis.spoken[0].onerror?.({ error: 'synthesis-failed' }));

    expect(result.current.error).toBe('synthesis-failed');
    expect(result.current.isSpeaking).toBe(false);
  });

  it('stops playback when the owner unmounts', () => {
    const synthesis = installSpeechSynthesis();
    const { result, unmount } = renderHook(() =>
      useSpeechSynthesis({ id: 'a', text: 'Hello' }),
    );

    act(() => result.current.toggle());
    unmount();

    expect(synthesis.cancel).toHaveBeenCalled();
  });
});

describe('speech synthesis helpers', () => {
  beforeEach(() => resetSpeechSynthesisStore());
  afterEach(() => {
    uninstallSpeechSynthesis();
    resetSpeechSynthesisStore();
  });

  it('prefers an exact language match, then a language match', () => {
    const voices = [
      { lang: 'en-GB', name: 'British' },
      { lang: 'ro-RO', name: 'Romanian' },
      { lang: 'en-US', name: 'American' },
    ];
    expect(pickVoice(voices, 'en-US')?.name).toBe('American');
    expect(pickVoice(voices, 'ro-MD')?.name).toBe('Romanian');
    expect(pickVoice(voices, 'de-DE')).toBeNull();
    expect(pickVoice([], 'de-DE')).toBeNull();
  });

  it('picks the matching voice for an utterance', () => {
    const synthesis = installSpeechSynthesis();
    synthesis.voices = [{ lang: 'ro-RO', name: 'Romanian' }];

    speakText({ id: 'a', text: 'Salut', lang: 'ro' });

    expect(synthesis.spoken[0].voice?.name).toBe('Romanian');
  });

  it('subscribes to voices once and refreshes the list', () => {
    const synthesis = installSpeechSynthesis();
    loadVoices();
    synthesis.voices = [{ lang: 'it-IT' }];
    loadVoices();

    expect(synthesis.addEventListener).toHaveBeenCalledTimes(1);

    synthesis.listeners.voiceschanged?.forEach((listener) => listener());
    expect(() => loadVoices()).not.toThrow();
  });

  it('does nothing when speech synthesis is unavailable', () => {
    expect(speakText({ id: 'a', text: 'Hello' })).toBe(false);
    expect(() => stopSpeaking()).not.toThrow();
  });
});
