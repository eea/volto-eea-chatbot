import { toSpeakableText } from '../utils/speechText';

describe('toSpeakableText', () => {
  it('returns an empty string for empty input', () => {
    expect(toSpeakableText()).toBe('');
    expect(toSpeakableText(null)).toBe('');
    expect(toSpeakableText('   ')).toBe('');
  });

  it('drops citation markers and citation links', () => {
    expect(toSpeakableText('Air quality improved [1].')).toBe(
      'Air quality improved.',
    );
    expect(toSpeakableText('Air quality improved [1](1).')).toBe(
      'Air quality improved.',
    );
  });

  it('keeps link text but drops targets', () => {
    expect(
      toSpeakableText('See the [EEA report](https://eea.europa.eu/report).'),
    ).toBe('See the EEA report.');
  });

  it('strips emphasis, headings, quotes and list markers', () => {
    expect(
      toSpeakableText(
        '## Findings\n\n> **Note** the _trend_\n\n- first item\n- second item\n1. third item',
      ),
    ).toBe('Findings Note the trend first item second item third item');
  });

  it('removes fenced code blocks but keeps inline code content', () => {
    expect(
      toSpeakableText(
        'Run `pm2 status` first.\n\n```js\nconst a = 1;\n```\n\nDone.',
      ),
    ).toBe('Run pm2 status first. Done.');
  });

  it('removes table separators and horizontal rules', () => {
    expect(toSpeakableText('---\n\n| a | b |\n| --- | --- |')).toBe(
      '| a | b |',
    );
  });

  it('collapses whitespace and trims', () => {
    expect(toSpeakableText('  a\n\n\n  b  ')).toBe('a b');
  });
});
