import { renderHook, act } from '@testing-library/react';

import { useSingleFlight } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useSingleFlight';

describe('useSingleFlight', () => {
  it('lets the first activation through and blocks the rest of the burst', () => {
    const { result } = renderHook(() => useSingleFlight());

    // A double click lands before React has rendered the disabled button, so
    // this is what actually stops a second fact-check run.
    let activations = [];
    act(() => {
      activations = [
        result.current.claim(),
        result.current.claim(),
        result.current.claim(),
      ];
    });

    expect(activations.filter(Boolean)).toHaveLength(1);
  });

  it('releases the slot once the work is over', () => {
    const { result } = renderHook(() => useSingleFlight());

    expect(result.current.claim()).toBe(true);
    expect(result.current.claim()).toBe(false);

    act(() => {
      result.current.release();
    });

    expect(result.current.claim()).toBe(true);
  });

  it('keeps the latch across re-renders', () => {
    const { result, rerender } = renderHook(() => useSingleFlight());

    expect(result.current.claim()).toBe(true);
    rerender();
    expect(result.current.claim()).toBe(false);
  });
});
