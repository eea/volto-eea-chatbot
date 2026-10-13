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
 * Three verdicts, three hues: red for a conflict, gray for silence, lime (a
 * yellow-leaning green) for support. Red-versus-green is the pair a red-green
 * colour blind reader cannot separate, so the good end leans towards yellow and
 * the middle one leaves the argument - and hue is still not the only signal:
 * each hue also gets its own underline style (see `.claim` in
 * `ChatBlock/style.less`) and the modal names the verdict in words.
 *
 * A claim whose sources were only partly loaded (`contextLimited`) is gray
 * whatever score it got: the header already refuses to name a verdict for it
 * ("Couldn't be checked"), so colouring it red or lime would claim more than the
 * check established.
 *
 * The class names must exist in `colors.less`: the `claim-*` utilities come from
 * an explicit list of `.generate-colors()` calls, and an unlisted class renders
 * unstyled, silently. `colors.test.js` asserts the two stay in step.
 */
export function getVerdictBgColor(score, contextLimited = false) {
  if (contextLimited) return 'claim-gray-500';
  if (score >= 0.8) return 'claim-lime-500';
  if (score >= 0.1) return 'claim-gray-500';
  return 'claim-red-500';
}
