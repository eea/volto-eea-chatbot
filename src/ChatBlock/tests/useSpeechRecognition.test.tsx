import { act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

type Listener = ((event: any) => void) | null;

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: Listener = null;
  start = jest.fn(() => this.onstart?.());
  stop = jest.fn(() => this.onend?.());
  abort = jest.fn();

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  emitResult(chunks: Array<{ transcript: string; isFinal: boolean }>) {
    const results: any = chunks.map((chunk) => {
      const result: any = [{ transcript: chunk.transcript }];
      result.isFinal = chunk.isFinal;
      result.length = 1;
      return result;
    });
    results.length = chunks.length;
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }
}

const setRecognitionConstructor = (value: unknown) => {
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    writable: true,
    value,
  });
};

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    setRecognitionConstructor(FakeSpeechRecognition);
  });

  afterEach(() => {
    setRecognitionConstructor(undefined);
    delete (window as any).webkitSpeechRecognition;
  });

  it('reports support when the browser exposes the API', () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: 'ro' }));
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);
  });

  it('reports missing support without throwing', () => {
    setRecognitionConstructor(undefined);
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);

    act(() => result.current.start());
    expect(result.current.error).toBe('unsupported');
  });

  it('configures language and starts listening', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ lang: 'ro', interimResults: true }),
    );

    act(() => result.current.start());

    const recognition = FakeSpeechRecognition.instances[0];
    expect(recognition.lang).toBe('ro-RO');
    expect(recognition.interimResults).toBe(true);
    expect(result.current.isListening).toBe(true);
  });

  it('emits final transcripts and tracks interim ones', () => {
    const onFinalTranscript = jest.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalTranscript }),
    );

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];

    act(() => recognition.emitResult([{ transcript: 'air qual', isFinal: false }]));
    expect(result.current.interimTranscript).toBe('air qual');
    expect(onFinalTranscript).not.toHaveBeenCalled();

    act(() =>
      recognition.emitResult([{ transcript: 'air quality in 2023', isFinal: true }]),
    );
    expect(onFinalTranscript).toHaveBeenCalledWith('air quality in 2023');
  });

  it('reports interim text so it can be previewed in the composer', () => {
    const onInterimTranscript = jest.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onInterimTranscript }),
    );

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];

    act(() => recognition.emitResult([{ transcript: 'air qual', isFinal: false }]));
    expect(onInterimTranscript).toHaveBeenLastCalledWith('air qual');

    act(() =>
      recognition.emitResult([{ transcript: 'air quality', isFinal: true }]),
    );
    expect(onInterimTranscript).toHaveBeenLastCalledWith('');
  });

  it('stops listening when recognition ends', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];
    expect(result.current.isListening).toBe(true);

    act(() => recognition.stop());
    expect(result.current.isListening).toBe(false);
    expect(result.current.interimTranscript).toBe('');
  });

  it('surfaces permission errors and can clear them', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];

    act(() => recognition.emitError('not-allowed'));
    expect(result.current.error).toBe('not-allowed');
    expect(result.current.isListening).toBe(false);

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('does not treat an aborted session as an error', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];

    act(() => recognition.emitError('aborted'));
    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(false);
  });

  it('aborts recognition on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());

    act(() => result.current.start());
    const recognition = FakeSpeechRecognition.instances[0];

    unmount();
    expect(recognition.abort).toHaveBeenCalled();
  });
});
