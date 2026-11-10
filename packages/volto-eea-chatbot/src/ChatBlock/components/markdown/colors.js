/**
 * Colour for a verdict: one per claim (`ClaimModal`) and one for the
 * answer-level summary (`HalloumiFeedback`).
 *
 * A per-claim score is a verdict (supported 1.0, not_enough_info 0.4,
 * contradicted 0.0 - see `scoreToVerdict`), not a measurement on a 0-1 scale, so
 * the eight-step red-to-green gradient that used to live in this file implied a
 * confidence level that was never computed, and it put `not_enough_info` in the
 * red family, which reads as "the sources contradict this" when they actually
 * said nothing.
 *
 * Three verdicts, three hues: red for a conflict, yellow for silence, green for
 * support. Hue alone is not enough - for red-green colour blindness the two ends
 * of that ramp are the same colour - so each hue also gets its own underline
 * style and weight (see `.claim` in `ChatBlock/style.less`) and the modal names
 * the verdict in words.
 *
 * A claim whose sources were only partly loaded (`contextLimited`) is yellow
 * whatever score it got: the header already refuses to name a verdict for it
 * ("Couldn't be checked"), so colouring it green or red would claim more than the
 * check established.
 *
 * The class names must exist in `colors.less`: the `claim-*` utilities come from
 * an explicit list of `.generate-colors()` calls, and an unlisted class renders
 * unstyled, silently. `colors.test.js` asserts the two stay in step.
 */
export function getVerdictBgColor(score, contextLimited = false) {
  if (contextLimited) return 'claim-yellow-500';
  if (score >= 0.8) return 'claim-green-500';
  if (score >= 0.1) return 'claim-yellow-500';
  return 'claim-red-500';
}
