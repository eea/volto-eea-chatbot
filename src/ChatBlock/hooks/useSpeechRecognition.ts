import { useCallback, useEffect, useRef, useState } from 'react';
import { toSpeechLanguage } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/speechLanguages';

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
  length: number;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/** Errors that only mean "the user stopped listening", not a failure. */
const SILENT_ERRORS = ['aborted', 'no-speech'];

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return (
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
  );
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 tag; resolved from the document language when omitted. */
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Called with every finalised chunk of recognised speech. */
  onFinalTranscript?: (transcript: string) => void;
  /** Called with the not-yet-final text, so it can be previewed. */
  onInterimTranscript?: (transcript: string) => void;
}

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
  clearError: () => void;
}

/**
 * Thin state machine around the browser Web Speech API.
 *
 * Audio never leaves the hook: the browser's speech service turns it into text
 * and only the transcript is surfaced, so nothing is retained client-side.
 */
export function useSpeechRecognition({
  lang,
  continuous = false,
  interimResults = true,
  onFinalTranscript,
  onInterimTranscript,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  onInterimTranscriptRef.current = onInterimTranscript;
  const [isSupported] = useState(isSpeechRecognitionSupported);

  const detach = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  }, []);

  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    detach();
    setIsListening(false);
    setInterimTranscript('');
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Already stopped: nothing to clean up.
      }
    }
  }, [detach]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return;
    }
    try {
      recognition.stop();
    } catch {
      abort();
    }
  }, [abort]);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError('unsupported');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('insecure-context');
      return;
    }

    abort();

    const recognition = new Recognition();
    recognition.lang = lang ? toSpeechLanguage(lang) : toSpeechLanguage();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      setError(null);
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      const finalChunks: string[] = [];
      for (
        let index = event.resultIndex ?? 0;
        index < (event.results?.length ?? 0);
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          finalChunks.push(transcript);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
      onInterimTranscriptRef.current?.(interim);
      const finalTranscript = finalChunks.join(' ').trim();
      if (finalTranscript) {
        onFinalTranscriptRef.current?.(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event?.error || 'unknown';
      setIsListening(false);
      setInterimTranscript('');
      setError(SILENT_ERRORS.includes(code) ? null : code);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      detach();
      setError('unknown');
    }
  }, [abort, continuous, detach, interimResults, lang]);

  useEffect(() => abort, [abort]);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    start,
    stop,
    abort,
    clearError,
  };
}
