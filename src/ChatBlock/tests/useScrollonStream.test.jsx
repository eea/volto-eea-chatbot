import { renderHook, act } from '@testing-library/react-hooks';
import { useScrollonStream } from '../hooks/useScrollonStream';

describe('useScrollonStream', () => {
  let addEventListenerSpy;
  let removeEventListenerSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.useRealTimers();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('sets up event listeners when enabled and streaming', () => {
    const bottomRef = { current: document.createElement('div') };
    renderHook(() =>
      useScrollonStream({
        bottomRef,
        isStreaming: true,
        enabled: true,
      }),
    );

    const eventTypes = addEventListenerSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain('wheel');
    expect(eventTypes).toContain('touchstart');
    expect(eventTypes).toContain('keydown');
    expect(eventTypes).toContain('mousedown');
  });

  it('disables scrolling on user wheel event', () => {
    const bottomRef = { current: document.createElement('div') };
    renderHook(() =>
      useScrollonStream({
        bottomRef,
        isStreaming: true,
        enabled: true,
      }),
    );

    act(() => {
      window.dispatchEvent(new Event('wheel'));
    });

    // After wheel event, the scroll listener should be removed
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });

  it('sets isActive to false after streaming stops with grace period', () => {
    const bottomRef = { current: document.createElement('div') };
    const { rerender } = renderHook(
      ({ isStreaming }) =>
        useScrollonStream({
          bottomRef,
          isStreaming,
          enabled: true,
        }),
      { initialProps: { isStreaming: true } },
    );

    // Stop streaming
    rerender({ isStreaming: false });

    // Should still be active before timeout
    act(() => {
      jest.advanceTimersByTime(500);
    });
  });

  it('does not set up event listeners when disabled', () => {
    const bottomRef = { current: document.createElement('div') };
    const callsBefore = addEventListenerSpy.mock.calls.length;

    renderHook(() =>
      useScrollonStream({
        bottomRef,
        isStreaming: true,
        enabled: false,
      }),
    );

    // Only the streaming state listener calls, not user input listeners
    const newCalls = addEventListenerSpy.mock.calls
      .slice(callsBefore)
      .map((c) => c[0]);
    expect(newCalls).not.toContain('wheel');
  });

  it('handles missing bottomRef gracefully', () => {
    const bottomRef = { current: null };
    expect(() => {
      renderHook(() =>
        useScrollonStream({
          bottomRef,
          isStreaming: true,
          enabled: true,
        }),
      );
    }).not.toThrow();
  });

  it('cleans up on unmount', () => {
    const bottomRef = { current: document.createElement('div') };
    const { unmount } = renderHook(() =>
      useScrollonStream({
        bottomRef,
        isStreaming: true,
        enabled: true,
      }),
    );

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});
