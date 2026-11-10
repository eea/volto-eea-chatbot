import fs from 'fs';
import path from 'path';
import { scoreToVerdict } from '../../utils';
import { getVerdictBgColor } from './colors';

const VERDICT_SCORES = [
  ['supported', 1.0],
  ['not_enough_info', 0.4],
  ['contradicted', 0.0],
];

const hueOf = (cls) => cls.match(/claim-([a-z]+)-/)[1];

describe('getVerdictBgColor', () => {
  it('gives each verdict one colour band', () => {
    expect(getVerdictBgColor(1.0)).toBe('claim-green-500');
    expect(getVerdictBgColor(0.8)).toBe('claim-green-500');
    expect(getVerdictBgColor(0.4)).toBe('claim-yellow-500');
    expect(getVerdictBgColor(0.1)).toBe('claim-yellow-500');
    expect(getVerdictBgColor(0.0)).toBe('claim-red-500');
  });

  it('uses three different hue families, one per verdict', () => {
    // A reader who cannot separate red from green must still tell the verdicts
    // apart, so no two of them may share a hue family. The green ladder this
    // replaced (green-700 / green-300 / red-500) failed that: two of the three
    // verdicts were "green".
    const hues = VERDICT_SCORES.map(([, score]) =>
      hueOf(getVerdictBgColor(score)),
    );
    expect(new Set(hues)).toEqual(new Set(['green', 'yellow', 'red']));
  });

  it('keeps not_enough_info out of the red family', () => {
    // red reads as "the sources contradict this"; they said nothing
    expect(hueOf(getVerdictBgColor(0.4))).not.toBe('red');
  });

  it('marks claims that could not be checked yellow, whatever the score', () => {
    // a claim checked against only part of its sources gets no verdict in the
    // header ("Couldn't be checked"), so the colour must not claim one either
    expect(getVerdictBgColor(1.0, true)).toBe('claim-yellow-500');
    expect(getVerdictBgColor(0.0, true)).toBe('claim-yellow-500');
  });

  it('colours verdicts exactly where scoreToVerdict names them', () => {
    // the colour bands and the wording in the modal are computed separately from
    // the same thresholds; if they drift, the chip says one thing and the header
    // another
    const hueForVerdict = {
      'claim-green-500': 'supported',
      'claim-yellow-500': 'not_enough_info',
      'claim-red-500': 'contradicted',
    };
    for (const score of [0, 0.05, 0.09, 0.1, 0.4, 0.79, 0.8, 1]) {
      expect(hueForVerdict[getVerdictBgColor(score)]).toBe(
        scoreToVerdict(score),
      );
    }
  });

  it('only emits classes that colors.less actually generates', () => {
    // an unlisted .generate-colors() call means the class renders unstyled, which
    // fails silently - no colour, no error
    const less = fs.readFileSync(path.join(__dirname, 'colors.less'), 'utf-8');
    for (const cls of [
      getVerdictBgColor(1.0),
      getVerdictBgColor(0.4),
      getVerdictBgColor(0.0),
    ]) {
      expect(less).toContain(
        `.generate-colors(claim, ${cls.replace('claim-', '')},`,
      );
    }
  });

  it('gives each verdict class its own underline style and weight in style.less', () => {
    // colour is not the only signal: each hue also has a line style and a line
    // weight, ranked by how much attention the finding asks for - a heavy wavy
    // line for a conflict, a medium dashed one for silence, a faint dotted one
    // for support. Renaming a class here without renaming the LESS selector
    // would drop the shape distinction silently, so assert both lists agree.
    const less = fs.readFileSync(
      path.join(__dirname, '..', '..', 'style.less'),
      'utf-8',
    );
    const expected = {
      'claim-red-500': { style: 'wavy', thickness: 3 },
      'claim-yellow-500': { style: 'dashed', thickness: 2.5 },
      'claim-green-500': { style: 'dotted', thickness: 1.5 },
    };
    const rules = {};
    for (const cls of [
      getVerdictBgColor(1.0),
      getVerdictBgColor(0.4),
      getVerdictBgColor(0.0),
    ]) {
      const block = less.match(new RegExp(`&\\.${cls} \\{([^}]*)\\}`));
      expect(block).not.toBeNull();
      rules[cls] = {
        style: /text-decoration-style:\s*([a-z]+);/.exec(block[1])?.[1],
        thickness: parseFloat(
          /text-decoration-thickness:\s*([\d.]+)px;/.exec(block[1])?.[1],
        ),
      };
      expect(rules[cls].style).toBe(expected[cls].style);
      expect(rules[cls].thickness).toBe(expected[cls].thickness);
    }
    // no two verdicts may share a style, and the weights must rank the same way
    // the verdicts do, otherwise the hierarchy is decoration
    expect(new Set(Object.values(rules).map((r) => r.style)).size).toBe(3);
    expect(rules['claim-red-500'].thickness).toBeGreaterThan(
      rules['claim-yellow-500'].thickness,
    );
    expect(rules['claim-yellow-500'].thickness).toBeGreaterThan(
      rules['claim-green-500'].thickness,
    );
  });
});
