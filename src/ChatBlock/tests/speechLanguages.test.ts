import { toSpeechLanguage, DEFAULT_SPEECH_LANGUAGE } from '../utils/speechLanguages';

describe('toSpeechLanguage', () => {
  const originalLang = document.documentElement.lang;

  afterEach(() => {
    document.documentElement.lang = originalLang;
  });

  it('maps a bare site locale to a regional BCP-47 tag', () => {
    expect(toSpeechLanguage('en')).toBe('en-US');
    expect(toSpeechLanguage('ro')).toBe('ro-RO');
    expect(toSpeechLanguage('de')).toBe('de-DE');
  });

  it('normalises locale separators and region subtags', () => {
    expect(toSpeechLanguage('en_GB')).toBe('en-GB');
    expect(toSpeechLanguage('pt-br')).toBe('pt-BR');
    expect(toSpeechLanguage('  ro-RO  ')).toBe('ro-RO');
  });

  it('keeps unknown languages usable as-is', () => {
    expect(toSpeechLanguage('xx')).toBe('xx');
    expect(toSpeechLanguage('xx-YY')).toBe('xx-YY');
  });

  it('falls back to the document language', () => {
    document.documentElement.lang = 'it';
    expect(toSpeechLanguage()).toBe('it-IT');
    expect(toSpeechLanguage(null)).toBe('it-IT');
  });

  it('falls back to the default language when nothing is known', () => {
    document.documentElement.lang = '';
    expect(toSpeechLanguage()).toBe(DEFAULT_SPEECH_LANGUAGE);
    expect(toSpeechLanguage('')).toBe(DEFAULT_SPEECH_LANGUAGE);
  });
});
