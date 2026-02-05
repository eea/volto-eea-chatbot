import { addCitations } from '../utils/citations';

describe('addCitations', () => {
  it('transforms single citation marker into markdown link', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'This is a fact [1].';
    const result = addCitations(text, message);
    expect(result).toBe('This is a fact [[1]](https://example.com/doc1).');
  });

  it('transforms multiple citation markers', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
        '2': 'https://example.com/doc2',
        '3': 'https://example.com/doc3',
      },
    };
    const text = 'Fact one [1], fact two [2], and fact three [3].';
    const result = addCitations(text, message);
    expect(result).toBe(
      'Fact one [[1]](https://example.com/doc1), fact two [[2]](https://example.com/doc2), and fact three [[3]](https://example.com/doc3).',
    );
  });

  it('does not transform already formatted citations [1](url)', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'Already formatted [[1]](https://example.com/doc1).';
    const result = addCitations(text, message);
    expect(result).toBe('Already formatted [[1]](https://example.com/doc1).');
  });

  it('does not transform citations in brackets like [1][', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'Text with [1][';
    const result = addCitations(text, message);
    expect(result).toBe('Text with [1][');
  });

  it('does not transform citations followed by ]', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'Text with [1]]';
    const result = addCitations(text, message);
    expect(result).toBe('Text with [1]]');
  });

  it('returns original text when no citations in message', () => {
    const message = {};
    const text = 'This is a fact [1].';
    const result = addCitations(text, message);
    expect(result).toBe('This is a fact [1].');
  });

  it('returns original text when citations is undefined', () => {
    const message = { citations: undefined };
    const text = 'This is a fact [1].';
    const result = addCitations(text, message);
    expect(result).toBe('This is a fact [1].');
  });

  it('handles text with no citation markers', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'This is plain text without citations.';
    const result = addCitations(text, message);
    expect(result).toBe('This is plain text without citations.');
  });

  it('handles double-digit citation numbers', () => {
    const message = {
      citations: {
        '10': 'https://example.com/doc10',
        '11': 'https://example.com/doc11',
      },
    };
    const text = 'References [10] and [11].';
    const result = addCitations(text, message);
    expect(result).toBe(
      'References [[10]](https://example.com/doc10) and [[11]](https://example.com/doc11).',
    );
  });

  it('handles citation number not in citations object', () => {
    const message = {
      citations: {
        '1': 'https://example.com/doc1',
      },
    };
    const text = 'Citation [2] not found.';
    const result = addCitations(text, message);
    // When citation number exists but is not in citations object,
    // the function returns the citation with undefined URL
    expect(result).toBe('Citation [[2]](undefined) not found.');
  });
});
