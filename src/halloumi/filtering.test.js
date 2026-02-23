import { parseExcludeIndices } from './filtering';

describe('parseExcludeIndices', () => {
  it('parses single indices', () => {
    const result = parseExcludeIndices('1,3,5', 6);
    expect(result).toEqual(new Set([1, 3, 5]));
  });

  it('returns empty set for NONE', () => {
    const result = parseExcludeIndices('NONE', 10);
    expect(result).toEqual(new Set());
  });

  it('returns empty set for none (lowercase)', () => {
    const result = parseExcludeIndices('  none  ', 10);
    expect(result).toEqual(new Set());
  });

  it('ignores indices below 1', () => {
    const result = parseExcludeIndices('0, 1, 3', 5);
    expect(result).toEqual(new Set([1, 3]));
  });

  it('ignores indices above maxIndex', () => {
    const result = parseExcludeIndices('1, 3, 99', 5);
    expect(result).toEqual(new Set([1, 3]));
  });

  it('handles whitespace variations', () => {
    const result = parseExcludeIndices('  1 ,  5 , 7  ', 10);
    expect(result).toEqual(new Set([1, 5, 7]));
  });

  it('extracts numbers even from unexpected formats', () => {
    // Parser uses match(/\d+/g) so it extracts all numbers
    const result = parseExcludeIndices('1-3, 5', 10);
    expect(result).toEqual(new Set([1, 3, 5]));
  });

  it('returns empty set for empty string with no numbers', () => {
    const result = parseExcludeIndices('no numbers here', 10);
    expect(result).toEqual(new Set());
  });
});
