import renderer from 'react-test-renderer';
import '@testing-library/jest-dom/extend-expect';
import { ClaimSegments } from '../components/markdown/ClaimSegments';

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
            onKeydown={() => {}}
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
jest.mock('../components/markdown/RenderClaimView', () => ({
  RenderClaimView: () => (
    <div data-testid="render-claim-view">RenderClaimView</div>
  ),
}));

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
});
