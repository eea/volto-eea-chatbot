export function getSupportedTextColor(score) {
  if (0 <= score && score < 0.5) {
    return 'text-red-500';
  } else if (0.5 <= score && score <= 1) {
    return 'text-green-500';
  }
  return 'text-gray-500';
}

/**
 * Colour for a single verified claim.
 *
 * A per-claim score is a verdict (supported 1.0, not_enough_info 0.4,
 * contradicted 0.0), not a measurement on a 0-1 scale, so the eight-step gradient
 * in `getSupportedBgColor` implied a confidence level that was never computed -
 * and it put `not_enough_info` in the red family, which reads as "the sources
 * contradict this" when they actually said nothing. Three bands, one per verdict:
 * red for a conflict, yellow for silence, green for support. The yellow band needs a
 * matching `.generate-colors(claim, yellow-500, …)` call in `colors.less` — the
 * `claim-*` utilities are an explicit list, and an unlisted class renders unstyled.
 */
export function getVerdictBgColor(score, prefix = 'claim') {
  if (score >= 0.8) return `${prefix}-green-500`;
  if (score >= 0.1) return `${prefix}-yellow-500`;
  return `${prefix}-red-500`;
}

export function getSupportedBgColor(score, prefix = 'bg') {
  if (0 <= score && score < 0.125) {
    return `${prefix}-red-500`;
  } else if (0.125 <= score && score < 0.25) {
    return `${prefix}-red-400`;
  } else if (0.25 <= score && score < 0.375) {
    return `${prefix}-red-300`;
  } else if (0.375 <= score && score < 0.5) {
    return `${prefix}-red-200`;
  } else if (0.5 <= score && score < 0.625) {
    return `${prefix}-green-200`;
  } else if (0.625 <= score && score < 0.75) {
    return `${prefix}-green-300`;
  } else if (0.75 <= score && score < 0.875) {
    return `${prefix}-green-400`;
  } else if (0.875 <= score && score <= 1) {
    return `${prefix}-green-500`;
  }
  return `${prefix}-gray-500`;
}
