import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { toSpeechLanguage } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/speechLanguages';

export interface SpeechSynthesisVoiceLike {
  default?: boolean;
  lang?: string;
  localService?: boolean;
  name?: string;
  voiceURI?: string;
}

export interface SpeechSynthesisUtteranceLike {
  lang: string;
  pitch: number;
  rate: number;
  text: string;
  voice: SpeechSynthesisVoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

export interface SpeechSynthesisLike {
  cancel: () => void;
  getVoices: () => SpeechSynthesisVoiceLike[];
  pause: () => void;
  resume: () => void;
  speak: (utterance: SpeechSynthesisUtteranceLike) => void;
  speaking?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface SpeechSynthesisWindow extends Window {
  speechSynthesis?: SpeechSynthesisLike;
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtteranceLike;
}

interface SynthesisState {
  /** Id of the utterance currently playing, `null` when idle. */
  activeId: string | null;
  error: { id: string; code: string } | null;
  voices: SpeechSynthesisVoiceLike[];
}

/**
 * Playback is global to the page (`speechSynthesis` is a single queue), so the
 * "who is speaking" state lives outside React and every mounted button
 * subscribes to it. That keeps at most one answer playing at a time without
 * threading a provider through the message tree.
 */
let state: SynthesisState = { activeId: null, error: null, voices: [] };
let currentUtteranceId: string | null = null;
let voicesSubscribed = false;
const listeners = new Set<() => void>();

const setState = (patch: Partial<SynthesisState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

export function getSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechSynthesisWindow;
  return speechWindow.speechSynthesis ?? null;
}

function getUtteranceConstructor(): (new (
  text: string,
) => SpeechSynthesisUtteranceLike) | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechSynthesisWindow;
  return speechWindow.SpeechSynthesisUtterance ?? null;
}

export function isSpeechSynthesisSupported(): boolean {
  return getSpeechSynthesis() !== null && getUtteranceConstructor() !== null;
}

/**
 * `getVoices()` is populated asynchronously by browsers; refresh the cached
 * list on `voiceschanged` so voice selection can see the real voices.
 */
export function loadVoices(): SpeechSynthesisVoiceLike[] {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) return [];
  const voices = synthesis.getVoices?.() ?? [];
  if (voices.length > 0) {
    setState({ voices });
  }
  if (!voicesSubscribed && synthesis.addEventListener) {
    voicesSubscribed = true;
    synthesis.addEventListener('voiceschanged', () => {
      const refreshed = synthesis.getVoices?.() ?? [];
      if (refreshed.length > 0) {
        setState({ voices: refreshed });
      }
    });
  }
  return voices;
}

export function pickVoice(
  voices: SpeechSynthesisVoiceLike[] | undefined,
  lang: string,
): SpeechSynthesisVoiceLike | null {
  if (!voices?.length || !lang) return null;
  const target = lang.toLowerCase().replace(/_/g, '-');
  const normalize = (value?: string) =>
    (value ?? '').toLowerCase().replace(/_/g, '-');

  const exact = voices.find((voice) => normalize(voice.lang) === target);
  if (exact) return exact;

  const language = target.split('-')[0];
  return (
    voices.find((voice) => normalize(voice.lang).startsWith(`${language}-`)) ??
    voices.find((voice) => normalize(voice.lang) === language) ??
    null
  );
}

export interface SpeakOptions {
  /** Identifies the playback owner so buttons can share one queue. */
  id: string;
  text: string;
  lang?: string;
  pitch?: number;
  rate?: number;
}

/**
 * Start reading `text` aloud, cancelling whatever was playing before.
 * Returns `false` when the browser has no speech synthesis support.
 */
export function speakText({
  id,
  text,
  lang,
  pitch = 1,
  rate = 1,
}: SpeakOptions): boolean {
  const synthesis = getSpeechSynthesis();
  const Utterance = getUtteranceConstructor();
  if (!synthesis || !Utterance || !text) return false;

  synthesis.cancel();

  const resolvedLanguage = lang ? toSpeechLanguage(lang) : toSpeechLanguage();
  const utterance = new Utterance(text);
  utterance.lang = resolvedLanguage;
  utterance.pitch = pitch;
  utterance.rate = rate;
  const voice = pickVoice(state.voices.length ? state.voices : loadVoices(), resolvedLanguage);
  if (voice) {
    utterance.voice = voice;
  }

  currentUtteranceId = id;

  utterance.onstart = () => {
    if (currentUtteranceId !== id) return;
    setState({ activeId: id, error: null });
  };

  utterance.onend = () => {
    if (currentUtteranceId !== id) return;
    currentUtteranceId = null;
    setState({ activeId: null });
  };

  utterance.onerror = (event) => {
    if (currentUtteranceId !== id) return;
    currentUtteranceId = null;
    setState({ activeId: null, error: { id, code: event?.error || 'error' } });
  };

  setState({ activeId: id, error: null });
  synthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  const synthesis = getSpeechSynthesis();
  currentUtteranceId = null;
  if (synthesis) {
    synthesis.cancel();
  }
  if (state.activeId !== null || state.error !== null) {
    setState({ activeId: null, error: null });
  }
}

/** Test helper: drops module state between test cases. */
export function resetSpeechSynthesisStore(): void {
  currentUtteranceId = null;
  voicesSubscribed = false;
  state = { activeId: null, error: null, voices: [] };
  listeners.clear();
}

export interface UseSpeechSynthesisOptions {
  /** Stable identity of this playback owner (one per message). */
  id: string;
  text: string;
  lang?: string;
  pitch?: number;
  rate?: number;
}

export interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  error: string | null;
  speak: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechSynthesis({
  id,
  text,
  lang,
  pitch,
  rate,
}: UseSpeechSynthesisOptions): UseSpeechSynthesisResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isSupported = isSpeechSynthesisSupported();
  const isSpeaking = snapshot.activeId === id;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const speak = useCallback(() => {
    speakText({ id, text, lang, pitch, rate });
  }, [id, lang, pitch, rate, text]);

  const stop = useCallback(() => {
    stopSpeaking();
  }, []);

  const toggle = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText({ id, text, lang, pitch, rate });
    }
  }, [id, isSpeaking, lang, pitch, rate, text]);

  useEffect(() => {
    loadVoices();
  }, []);

  // Leaving the page (or the toolbar unmounting while streaming) must not keep
  // the browser talking.
  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) {
        stopSpeaking();
      }
    };
  }, []);

  return {
    isSupported,
    isSpeaking,
    error: snapshot.error?.id === id ? snapshot.error.code : null,
    speak,
    stop,
    toggle,
  };
}
