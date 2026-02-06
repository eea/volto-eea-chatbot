import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import '@testing-library/jest-dom/extend-expect';
import {
  EMAIL_REGEX,
  transformEmailsToLinks,
  debounce,
  useCopyToClipboard,
  convertToPercentage,
  createChatMessageFeedback,
} from '../utils';

describe('utils', () => {
  describe('EMAIL_REGEX', () => {
    it('matches valid email addresses', () => {
      expect('test@example.com').toMatch(EMAIL_REGEX);
      expect('user.name@domain.org').toMatch(EMAIL_REGEX);
      expect('user+tag@example.co.uk').toMatch(EMAIL_REGEX);
    });

    it('does not match invalid email addresses', () => {
      expect('not-an-email').not.toMatch(EMAIL_REGEX);
      expect('@missing-local.com').not.toMatch(EMAIL_REGEX);
    });
  });

  describe('transformEmailsToLinks', () => {
    it('transforms email addresses to mailto links', () => {
      const text = 'Contact us at test@example.com';
      const result = transformEmailsToLinks(text);
      // Result includes: ['Contact us at ', <a>email</a>, '']
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toBe('Contact us at ');
    });

    it('handles text without email addresses', () => {
      const text = 'No email here';
      const result = transformEmailsToLinks(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('No email here');
    });

    it('handles multiple email addresses', () => {
      const text = 'Email one@test.com and two@test.com';
      const result = transformEmailsToLinks(text);
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('calls the function immediately on first call', () => {
      const callable = jest.fn();
      const clickSignal = { current: null };

      debounce(callable, clickSignal);

      expect(callable).toHaveBeenCalledTimes(1);
    });

    it('prevents multiple calls within debounce period', () => {
      const callable = jest.fn();
      const clickSignal = { current: null };

      debounce(callable, clickSignal);
      debounce(callable, clickSignal);
      debounce(callable, clickSignal);

      expect(callable).toHaveBeenCalledTimes(1);
    });

    it('allows call after debounce period', () => {
      const callable = jest.fn();
      const clickSignal = { current: null };

      debounce(callable, clickSignal);
      expect(callable).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);

      debounce(callable, clickSignal);
      expect(callable).toHaveBeenCalledTimes(2);
    });
  });

  describe('useCopyToClipboard', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns initial state as not copied', () => {
      const { result } = renderHook(() => useCopyToClipboard('test'));
      expect(result.current[0]).toBe(false);
    });

    it('copies text to clipboard when copy is called', async () => {
      const { result } = renderHook(() => useCopyToClipboard('test text'));

      await act(async () => {
        result.current[1]();
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(result.current[0]).toBe(true);
    });

    it('resets copied state after timeout', async () => {
      const { result } = renderHook(() => useCopyToClipboard('test'));

      await act(async () => {
        result.current[1]();
      });

      expect(result.current[0]).toBe(true);

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current[0]).toBe(false);
    });

    it('handles clipboard write failure', async () => {
      navigator.clipboard.writeText = jest.fn().mockRejectedValue(new Error());

      const { result } = renderHook(() => useCopyToClipboard('test'));

      await act(async () => {
        result.current[1]();
      });

      expect(result.current[0]).toBe(false);
    });
  });

  describe('convertToPercentage', () => {
    it('converts float to percentage string', () => {
      expect(convertToPercentage(0.5)).toBe('50.00%');
      expect(convertToPercentage(0.123)).toBe('12.30%');
      expect(convertToPercentage(1)).toBe('100.00%');
      expect(convertToPercentage(0)).toBe('0.00%');
    });

    it('handles custom digit precision', () => {
      expect(convertToPercentage(0.5, 0)).toBe('50%');
      expect(convertToPercentage(0.5, 1)).toBe('50.0%');
      expect(convertToPercentage(0.123, 1)).toBe('12.3%');
    });

    it('returns 0% for values outside 0-1 range', () => {
      expect(convertToPercentage(-0.5)).toBe('0%');
      expect(convertToPercentage(1.5)).toBe('0%');
      expect(convertToPercentage(-1)).toBe('0%');
    });
  });

  describe('createChatMessageFeedback', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('sends positive feedback correctly', async () => {
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createChatMessageFeedback({
        chat_message_id: '123',
        is_positive: true,
        feedback_text: 'Great response!',
      });

      expect(fetch).toHaveBeenCalledWith(
        '/_da/chat/create-chat-message-feedback',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.chat_message_id).toBe('123');
      expect(callBody.is_positive).toBe(true);
      expect(callBody.predefined_feedback).toBeUndefined();
    });

    it('sends negative feedback with predefined reason', async () => {
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await createChatMessageFeedback({
        chat_message_id: '123',
        is_positive: false,
        predefined_feedback: 'Incorrect information',
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.is_positive).toBe(false);
      expect(callBody.predefined_feedback).toBe('Incorrect information');
    });

    it('throws error on failed request', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        createChatMessageFeedback({
          chat_message_id: '123',
          is_positive: true,
        }),
      ).rejects.toThrow('Failed to submit feedback.');
    });
  });
});
