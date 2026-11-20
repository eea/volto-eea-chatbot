import { useCallback, useMemo, useRef } from 'react';

/**
 * A synchronous single-flight latch.
 *
 * `disabled` is the right thing to render, but it only exists a commit after the
 * click that should have set it - and a double click arrives well inside that
 * window. For anything that costs money or time to start (an LLM run, a large
 * upload), the guard has to be a ref flipped during the click handler, not a
 * piece of state read at render time.
 *
 * Same reasoning as the in-flight lock in FeedbackModal's submit handler.
 */
export function useSingleFlight() {
  const active = useRef(false);

  /** Take the slot. Returns false if something is already in flight. */
  const claim = useCallback(() => {
    if (active.current) {
      return false;
    }
    active.current = true;
    return true;
  }, []);

  /** Hand the slot back once the work finishes, fails or is cancelled. */
  const release = useCallback(() => {
    active.current = false;
  }, []);

  // Stable identity, so effects can depend on the returned object.
  return useMemo(() => ({ claim, release }), [claim, release]);
}
