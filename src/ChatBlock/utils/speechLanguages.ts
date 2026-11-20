/**
 * Mapping from site locales to BCP-47 tags understood by the browser speech
 * APIs (`SpeechRecognition.lang` / `SpeechSynthesisUtterance.lang`).
 *
 * Only bare language subtags are mapped; a locale that already carries a
 * region (`en-GB`, `pt-BR`) is normalised and used as-is.
 */
export const DEFAULT_SPEECH_LANGUAGE = 'en-US';

const SPEECH_LANGUAGE_BY_LANGUAGE: Record<string, string> = {
  bg: 'bg-BG',
  cs: 'cs-CZ',
  da: 'da-DK',
  de: 'de-DE',
  el: 'el-GR',
  en: 'en-US',
  es: 'es-ES',
  et: 'et-EE',
  fi: 'fi-FI',
  fr: 'fr-FR',
  ga: 'ga-IE',
  hr: 'hr-HR',
  hu: 'hu-HU',
  is: 'is-IS',
  it: 'it-IT',
  lt: 'lt-LT',
  lv: 'lv-LV',
  mt: 'mt-MT',
  nb: 'nb-NO',
  nl: 'nl-NL',
  no: 'nb-NO',
  pl: 'pl-PL',
  pt: 'pt-PT',
  ro: 'ro-RO',
  sk: 'sk-SK',
  sl: 'sl-SI',
  sv: 'sv-SE',
  tr: 'tr-TR',
  uk: 'uk-UA',
};

const normalizeLocale = (locale: string): string =>
  String(locale).trim().replace(/_/g, '-');

/**
 * Resolve a site locale (e.g. `en`, `en_GB`, `ro`) to a BCP-47 speech tag.
 *
 * Falls back to the document language, then to `en-US`.
 */
export function toSpeechLanguage(
  locale?: string | null,
  depth = 0,
): string {
  const normalized = locale ? normalizeLocale(locale) : '';

  if (normalized) {
    const [language, ...subtags] = normalized.split('-').filter(Boolean);
    if (!language) {
      return DEFAULT_SPEECH_LANGUAGE;
    }
    const languageCode = language.toLowerCase();
    if (subtags.length === 0) {
      return SPEECH_LANGUAGE_BY_LANGUAGE[languageCode] ?? languageCode;
    }
    return [
      languageCode,
      ...subtags.map((subtag) =>
        subtag.length === 2 ? subtag.toUpperCase() : subtag,
      ),
    ].join('-');
  }

  if (depth < 2 && typeof document !== 'undefined') {
    const documentLanguage = document.documentElement?.getAttribute('lang');
    if (documentLanguage) {
      return toSpeechLanguage(documentLanguage, depth + 1);
    }
  }

  return DEFAULT_SPEECH_LANGUAGE;
}
