/**
 * Assistant answers are Markdown with citation markers. Reading the raw source
 * aloud produces noise (`**`, `[1]`, URLs, table pipes), so the text is
 * reduced to what a human would actually read.
 */

const FENCED_CODE_BLOCK = /```[\s\S]*?```/g;
const HTML_TAG = /<\/?[a-z][^>]*>/gi;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
/** Citation markers already turned into links by `addCitations`. */
const CITATION_LINK = /\[\d+\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
/** Same shape as the citation markers handled by `addCitations`. */
const CITATION_MARKER = /\[\d+\](?![[(\])])/g;
const HEADING = /^#{1,6}\s+/gm;
const BLOCKQUOTE = /^\s*>\s?/gm;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/gm;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]+\|[\s:|-]*$/gm;
const HORIZONTAL_RULE = /^\s*(?:[-*_]\s*){3,}$/gm;
const EMPHASIS = /(\*\*|__|~~|\*|_)/g;
const INLINE_CODE = /`([^`]*)`/g;
const SURROUNDING_WHITESPACE = /\s+/g;
const SPACE_BEFORE_PUNCTUATION = / ([.,;:!?])/g;

export function toSpeakableText(markdown?: string | null): string {
  if (!markdown) return '';

  return String(markdown)
    .replace(FENCED_CODE_BLOCK, ' ')
    .replace(HTML_TAG, ' ')
    .replace(IMAGE, '$1')
    .replace(CITATION_LINK, '')
    .replace(LINK, '$1')
    .replace(CITATION_MARKER, '')
    .replace(TABLE_SEPARATOR, '')
    .replace(HEADING, '')
    .replace(BLOCKQUOTE, '')
    .replace(LIST_ITEM, '')
    .replace(HORIZONTAL_RULE, '')
    .replace(INLINE_CODE, '$1')
    .replace(EMPHASIS, '')
    .replace(SURROUNDING_WHITESPACE, ' ')
    .replace(SPACE_BEFORE_PUNCTUATION, '$1')
    .trim();
}
