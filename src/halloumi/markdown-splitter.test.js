import { splitMarkdown } from './markdown-splitter';

const DUMMY_LLM_RESPONSE = `## European species most at risk

Below is a concise, evidence-based snapshot of the taxonomic groups and flagship species. The list combines information on trend magnitude and risk status.

| Taxonomic group | Species at risk | Main drivers | Signal |
|-----------------|-----------------|--------------|--------|
| **Birds** | Skylark (*Alauda arvensis*), European turtle-dove | Intensive agriculture, pesticide use | Farmland-bird index down 27% (1990-2019) |
| **Fish** | Houting (*Coregonus oxyrhynchus*), Danube salmon | River regulation, dam construction | Both listed as critically endangered |
| **Butterflies** | Large blue (*Phengaris arion*), Adonis blue | Loss of semi-natural grasslands | Grassland-butterfly index down 25% |

### Key take-aways

1. **Agricultural intensification** is the single biggest pressure across taxa.
2. **Habitat loss and degradation** underlie the perilous status of many specialists.
3. **Chemical stressors** affect both insects and the birds that depend on them.
4. **Climate change** amplifies existing pressures such as drought stress on amphibians.

---

### Conservation priorities

- **Protect and restore semi-natural habitats** including high-diversity grasslands and river floodplains.
- **Implement agri-environment schemes** that limit pesticide use and maintain field margins.
- **Focus monitoring on flagship species** to gauge the effectiveness of policy actions.

If you need a deeper dive into a particular taxon, just let me know!`;

describe('splitMarkdown', () => {
  it('should split the dummy LLM response into meaningful segments', () => {
    const segments = splitMarkdown(DUMMY_LLM_RESPONSE);

    // Headers are separate segments
    expect(segments).toContain('## European species most at risk');
    expect(segments).toContain('### Key take-aways');
    expect(segments).toContain('### Conservation priorities');

    // Table rows are individual segments (separator skipped)
    const tableRows = segments.filter((s) => s.startsWith('|'));
    expect(tableRows.length).toBe(4); // header row + 3 data rows

    // Numbered list items are separate
    const numberedItems = segments.filter((s) => /^\d+\./.test(s.trimStart()));
    expect(numberedItems.length).toBe(4);

    // Bullet list items are separate
    const bulletItems = segments.filter((s) => /^-\s/.test(s.trimStart()));
    expect(bulletItems.length).toBe(3);

    // Prose paragraphs are split into sentences
    expect(segments).toContainEqual(
      expect.stringContaining('evidence-based snapshot'),
    );
    expect(segments).toContainEqual(expect.stringContaining('trend magnitude'));

    // Horizontal rules are skipped
    expect(segments).not.toContainEqual(expect.stringMatching(/^-{3,}$/));

    // No empty segments
    expect(segments.every((s) => s.trim().length > 0)).toBe(true);
  });

  it('should handle plain prose without markdown', () => {
    const text =
      'This is sentence one. This is sentence two. This is sentence three.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual([
      'This is sentence one.',
      'This is sentence two.',
      'This is sentence three.',
    ]);
  });

  it('should handle headers followed by prose', () => {
    const text = '## My Header\n\nSome prose paragraph here.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual(['## My Header', 'Some prose paragraph here.']);
  });

  it('should skip table separator rows', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |';
    const segments = splitMarkdown(text);
    expect(segments).toEqual(['| A | B |', '| 1 | 2 |']);
  });

  it('should handle numbered lists', () => {
    const text =
      '1. First item with enough text.\n2. Second item also long enough.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual([
      '1. First item with enough text.',
      '2. Second item also long enough.',
    ]);
  });

  it('should handle bullet lists', () => {
    const text =
      '- First bullet point.\n- Second bullet point.\n- Third bullet point.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual([
      '- First bullet point.',
      '- Second bullet point.',
      '- Third bullet point.',
    ]);
  });

  it('should skip horizontal rules', () => {
    const text = 'Before the rule.\n\n---\n\nAfter the rule.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual(['Before the rule.', 'After the rule.']);
  });

  it('should return an empty array for empty string', () => {
    expect(splitMarkdown('')).toEqual([]);
  });

  it('should merge short prose fragments', () => {
    const text = 'Hi. This is a longer sentence here.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual(['Hi. This is a longer sentence here.']);
  });

  it('should join multi-line prose into a single paragraph before splitting', () => {
    const text =
      'This is the first line of a paragraph.\nThis is the second line of the same paragraph.';
    const segments = splitMarkdown(text);
    // Should be joined and then split by Intl.Segmenter
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments.join('')).toContain('first line');
    expect(segments.join('')).toContain('second line');
  });
});
