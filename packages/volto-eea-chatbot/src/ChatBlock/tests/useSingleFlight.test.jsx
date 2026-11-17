import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { useSingleFlight } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useSingleFlight';

/**
 * A probe component rather than `renderHook`: testing-library's renderHook only
 * exists from v13.1, and this add-on is also tested against Volto 17, which
 * pins testing-library 12.1.5.
 */
function renderFlight() {
  const box = { current: null };

  function Probe() {
    box.current = useSingleFlight();
    const [claimed, setClaimed] = React.useState([]);
    return (
      <button
        onClick={() => {
          const ok = box.current.claim();
          setClaimed((prev) => [...prev, ok]);
        }}
      >
        {`claims:${claimed.filter(Boolean).length}`}
      </button>
    );
  }

  render(<Probe />);
  return box;
}

describe('useSingleFlight', () => {
  it('lets the first activation through and blocks the rest of the burst', () => {
    const result = renderFlight();
    const button = screen.getByRole('button');

    // A double click lands before React has rendered the disabled button, so
    // this is what actually stops a second fact-check run.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(screen.getByText('claims:1')).toBeInTheDocument();
    expect(result.current.claim()).toBe(false);
  });

  it('releases the slot once the work is over', () => {
    const result = renderFlight();

    expect(result.current.claim()).toBe(true);
    expect(result.current.claim()).toBe(false);

    act(() => {
      result.current.release();
    });

    expect(result.current.claim()).toBe(true);
  });

  it('keeps the latch across re-renders', () => {
    const result = renderFlight();

    expect(result.current.claim()).toBe(true);
    fireEvent.click(screen.getByRole('button'));
    expect(result.current.claim()).toBe(false);
  });
});
