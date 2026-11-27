import {
  flattenTranscript,
  isTruncated,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/priorTranscript';

const user = (message, nodeId = 1) => ({ type: 'user', message, nodeId });
const assistant = (message, nodeId = 2) => ({
  type: 'assistant',
  message,
  nodeId,
});
const errored = (message, nodeId = 2) => ({
  type: 'assistant',
  message,
  nodeId,
  error: 'Error: boom',
});

describe('flattenTranscript', () => {
  it('renders the conversation as labelled turns', () => {
    expect(
      flattenTranscript([
        user('Hello there'),
        assistant('Hi, how can I help?'),
      ]),
    ).toBe('User: Hello there\n\nAssistant: Hi, how can I help?');
  });

  it('returns null when there is nothing to hand over', () => {
    expect(flattenTranscript([])).toBeNull();
    expect(flattenTranscript([errored('')])).toBeNull();
  });

  it('drops a question whose answer failed', () => {
    // Stream errors arrive as assistant messages carrying an error field.
    const transcript = flattenTranscript([
      user('What is this?'),
      errored(''),
      user('Try again'),
      assistant('It is a chatbot.'),
    ]);

    expect(transcript).toBe('User: Try again\n\nAssistant: It is a chatbot.');
  });

  it('drops a question followed by a transport error message', () => {
    const transcript = flattenTranscript([
      user('Lost question'),
      { type: 'error', message: '', nodeId: 2 },
      user('Kept question'),
      assistant('Answer'),
    ]);

    expect(transcript).toBe('User: Kept question\n\nAssistant: Answer');
  });

  it('keeps the newest whole turns under the cap and marks the truncation', () => {
    const transcript = flattenTranscript(
      [user('A'.repeat(50)), assistant('B'.repeat(50)), user('C'.repeat(50))],
      100,
    );

    expect(transcript.startsWith('[Earlier conversation truncated]')).toBe(
      true,
    );
    expect(transcript).toContain('C'.repeat(50));
    expect(transcript).not.toContain('A'.repeat(50));
  });

  it('keeps the tail of a single turn that alone exceeds the cap', () => {
    const transcript = flattenTranscript([user(`HEAD${'X'.repeat(200)}`)], 100);

    expect(transcript.startsWith('[Earlier conversation truncated]')).toBe(
      true,
    );
    expect(transcript.length).toBeLessThanOrEqual(100);
    expect(transcript.endsWith('X')).toBe(true);
  });
  it('keeps the whole result inside the cap, marker included', () => {
    const transcript = flattenTranscript(
      [user('A'.repeat(80)), user('B'.repeat(80))],
      100,
    );
    const whole = flattenTranscript([user('short')], 100);

    expect(transcript.length).toBeLessThanOrEqual(100);
    expect(isTruncated(transcript)).toBe(true);
    expect(isTruncated(whole)).toBe(false);
  });
});
