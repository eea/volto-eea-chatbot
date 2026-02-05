import { renderHook, act } from '@testing-library/react-hooks';

// Mock the streaming service
jest.mock('../services/streamingService', () => ({
  sendMessage: jest.fn(),
  createChatSession: jest.fn(),
}));

import { useChatStreaming } from '../hooks/useChatStreaming';
import { sendMessage } from '../services/streamingService';
import { PacketType } from '../types/streamingModels';

describe('useChatStreaming', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useChatStreaming());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentMessage).toBeNull();
    expect(typeof result.current.startStreaming).toBe('function');
    expect(typeof result.current.cancelStreaming).toBe('function');
  });

  it('starts and completes streaming', async () => {
    const packets = [
      {
        ind: 1,
        obj: { type: PacketType.MESSAGE_START, content: 'Hello' },
      },
    ];

    sendMessage.mockImplementation(async function* () {
      yield packets;
    });

    const onMessageUpdate = jest.fn();
    const onComplete = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() =>
      useChatStreaming({ onMessageUpdate, onComplete }),
    );

    await act(async () => {
      await result.current.startStreaming(
        {
          message: 'test',
          chatSessionId: 'session-1',
          parentMessageId: null,
          regenerate: false,
          filters: null,
          selectedDocumentIds: [],
        },
        1,
        null,
      );
    });

    expect(result.current.isStreaming).toBe(false);
    expect(onMessageUpdate).toHaveBeenCalled();
  });

  it('handles streaming error', async () => {
    sendMessage.mockImplementation(async function* () {
      throw new Error('Stream failed');
    });

    const onError = jest.fn();

    const { result } = renderHook(() => useChatStreaming({ onError }));

    await act(async () => {
      await result.current.startStreaming(
        {
          message: 'test',
          chatSessionId: 'session-1',
          parentMessageId: null,
          regenerate: false,
          filters: null,
          selectedDocumentIds: [],
        },
        1,
        null,
      );
    });

    expect(result.current.isStreaming).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.anything(),
    );
  });

  it('cancelStreaming aborts the stream', async () => {
    let resolveStream;
    const streamPromise = new Promise((resolve) => {
      resolveStream = resolve;
    });

    sendMessage.mockImplementation(async function* () {
      await streamPromise;
      yield [];
    });

    const { result } = renderHook(() => useChatStreaming());

    // Start streaming without awaiting
    act(() => {
      result.current.startStreaming(
        {
          message: 'test',
          chatSessionId: 'session-1',
          parentMessageId: null,
          regenerate: false,
          filters: null,
          selectedDocumentIds: [],
        },
        1,
        null,
      );
    });

    // Cancel the stream
    act(() => {
      result.current.cancelStreaming();
    });

    expect(result.current.isStreaming).toBe(false);

    // Cleanup
    resolveStream();
  });

  it('does not call onError for AbortError', async () => {
    sendMessage.mockImplementation(async function* () {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });

    const onError = jest.fn();

    const { result } = renderHook(() => useChatStreaming({ onError }));

    await act(async () => {
      await result.current.startStreaming(
        {
          message: 'test',
          chatSessionId: 'session-1',
          parentMessageId: null,
          regenerate: false,
          filters: null,
          selectedDocumentIds: [],
        },
        1,
        null,
      );
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
