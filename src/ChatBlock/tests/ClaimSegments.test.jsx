import renderer from 'react-test-renderer';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClaimSegments } from '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/ClaimSegments';

// Mock semantic-ui-react
jest.mock('semantic-ui-react', () => ({
  Tab: ({ panes, activeIndex }) => (
    <div data-testid="tab">
      <div data-testid="tab-menu">
        {panes.map((pane, i) => (
          <div
            key={i}
            data-testid={`menu-item-${i}`}
            className={pane.menuItem.className}
            onClick={pane.menuItem.onClick}
            onKeyDown={() => {}}
            role="tab"
            tabIndex={i === activeIndex ? 0 : -1}
            aria-selected={i === activeIndex}
            aria-controls={`tab-pane-${i}`}
          >
            {pane.menuItem.content}
          </div>
        ))}
      </div>
      <div data-testid="tab-content">{panes[activeIndex]?.render()}</div>
    </div>
  ),
  TabPane: ({ children }) => <div data-testid="tab-pane">{children}</div>,
}));

// Mock RenderClaimView
jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/RenderClaimView',
  () => ({
    RenderClaimView: () => (
      <div data-testid="render-claim-view">RenderClaimView</div>
    ),
  }),
);

describe('ClaimSegments', () => {
  const defaultProps = {
    segmentIds: [1, 2],
    segments: {
      1: { id: 1, startOffset: 0, endOffset: 10 },
      2: { id: 2, startOffset: 15, endOffset: 25 },
    },
    citedSources: [
      {
        id: 'source1',
        semantic_identifier: 'Source Document 1',
        link: 'https://example.com/1',
        source_type: 'web',
        halloumiContext: 'This is the context text for source 1.',
        index: 1,
      },
    ],
  };

  it('renders with basic props', () => {
    const component = renderer.create(<ClaimSegments {...defaultProps} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with multiple sources', () => {
    const props = {
      ...defaultProps,
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: 'https://example.com/1',
          source_type: 'web',
          halloumiContext: 'Context for source 1.',
          index: 1,
        },
        {
          id: 'source2',
          semantic_identifier: 'Source 2',
          link: 'https://example.com/2',
          source_type: 'file',
          halloumiContext: 'Context for source 2.',
          index: 2,
        },
      ],
      segments: {
        1: { id: 1, startOffset: 0, endOffset: 10 },
        2: { id: 2, startOffset: 22, endOffset: 32 },
      },
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty segmentIds', () => {
    const props = {
      ...defaultProps,
      segmentIds: [],
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles null segmentIds', () => {
    const props = {
      ...defaultProps,
      segmentIds: null,
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles missing segments in segments object', () => {
    // Suppress console.warn for this test
    const originalWarn = console.warn;
    console.warn = jest.fn();

    const props = {
      ...defaultProps,
      segmentIds: [1, 999], // 999 doesn't exist
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
    expect(console.warn).toHaveBeenCalled();

    console.warn = originalWarn;
  });

  it('renders source without link', () => {
    const props = {
      ...defaultProps,
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: null,
          source_type: 'file',
          halloumiContext: 'Context for source 1.',
          index: 1,
        },
      ],
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with file source type icon', () => {
    const props = {
      ...defaultProps,
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Internal Document',
          link: 'https://example.com/1',
          source_type: 'file',
          halloumiContext: 'Context text.',
          index: 1,
        },
      ],
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('filters out sources without matching snippets', () => {
    const props = {
      segmentIds: [1],
      segments: {
        1: { id: 1, startOffset: 0, endOffset: 10 },
      },
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: null,
          source_type: 'web',
          halloumiContext: 'Short context.',
          index: 1,
        },
        {
          id: 'source2',
          semantic_identifier: 'Source 2 (no snippets)',
          link: null,
          source_type: 'web',
          halloumiContext: 'This source has no matching segments.',
          index: 2,
        },
      ],
    };

    const component = renderer.create(<ClaimSegments {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders one tab per source cited by a multi-evidence claim', () => {
    // Two 20-char sources → joined offsets: source1 [0,20), source2 [20,40)
    const props = {
      segmentIds: ['1', '2', '3'],
      segments: {
        1: { id: 1, startOffset: 0, endOffset: 10 },
        2: { id: 2, startOffset: 25, endOffset: 35 },
        3: { id: 3, startOffset: 21, endOffset: 24 },
      },
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: null,
          source_type: 'file',
          halloumiContext: '01234567890123456789',
          index: 1,
        },
        {
          id: 'source2',
          semantic_identifier: 'Source 2',
          link: null,
          source_type: 'web',
          halloumiContext: '01234567890123456789',
          index: 2,
        },
      ],
    };

    render(<ClaimSegments {...props} />);

    expect(screen.getByTestId('tab-menu').children).toHaveLength(2);
    // The mocked Tab renders one pane at a time: source 1 has one citation
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '#1',
    ]);

    fireEvent.click(screen.getByTestId('menu-item-1'));
    // source 2 has a chip per evidence quote
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '#2',
      '#3',
    ]);
  });

  it('attributes a segment that runs past the end of its source', () => {
    const props = {
      segmentIds: [1],
      segments: {
        1: { id: 1, startOffset: 15, endOffset: 25 }, // source is 20 chars long
      },
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: null,
          source_type: 'file',
          halloumiContext: '01234567890123456789',
          index: 1,
        },
      ],
    };

    render(<ClaimSegments {...props} />);

    // The citation is kept (clamped to the source) instead of vanishing
    expect(screen.getByTestId('tab-menu').children).toHaveLength(1);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('warns and drops a segment that belongs to no source', () => {
    const originalWarn = console.warn;
    console.warn = jest.fn();

    const props = {
      segmentIds: [1],
      segments: {
        1: { id: 1, startOffset: 100, endOffset: 110 },
      },
      citedSources: [
        {
          id: 'source1',
          semantic_identifier: 'Source 1',
          link: null,
          source_type: 'file',
          halloumiContext: '01234567890123456789',
          index: 1,
        },
      ],
    };

    render(<ClaimSegments {...props} />);

    expect(console.warn).toHaveBeenCalledWith(
      'Could not attribute segment 1 to a source',
      { startOffset: 100, endOffset: 110 },
      expect.any(Array),
    );
    expect(screen.getByTestId('tab-menu').children).toHaveLength(0);

    console.warn = originalWarn;
  });
});
