import React from 'react';
import renderer from 'react-test-renderer';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RenderClaimView } from '../components/markdown/RenderClaimView';

describe('RenderClaimView', () => {
  const createRef = () => ({ current: {} });

  it('renders plain text without segments', () => {
    const props = {
      value: 'This is plain text without any segments.',
      segments: [],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders text with a single segment', () => {
    const props = {
      value: 'This is text with a segment here.',
      segments: [
        {
          id: 1,
          startOffset: 20,
          endOffset: 27,
        },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders text with multiple segments', () => {
    const props = {
      value: 'First segment and second segment here.',
      segments: [
        { id: 1, startOffset: 0, endOffset: 13 },
        { id: 2, startOffset: 18, endOffset: 32 },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('highlights visible segment', () => {
    const props = {
      value: 'This is text with a segment here.',
      segments: [
        {
          id: 1,
          startOffset: 20,
          endOffset: 27,
        },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: 1,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    render(<RenderClaimView {...props} />);
    const segment = document.querySelector('.citation-segment.active');
    expect(segment).toBeInTheDocument();
  });

  it('handles segments with sourceStartIndex offset', () => {
    const props = {
      value: 'text with segment.',
      segments: [
        {
          id: 1,
          startOffset: 110,
          endOffset: 117,
        },
      ],
      sourceStartIndex: 100,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles text with newlines', () => {
    const props = {
      value: 'Line one\nLine two\nLine three',
      segments: [],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles segment ending with newline', () => {
    const props = {
      value: 'Segment text\nMore text',
      segments: [
        {
          id: 1,
          startOffset: 0,
          endOffset: 13,
        },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('filters out DOCUMENT and Source lines', () => {
    const props = {
      value: 'DOCUMENT 1\nActual content\nSource: test',
      segments: [],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    render(<RenderClaimView {...props} />);
    expect(screen.queryByText(/DOCUMENT 1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source: test/)).not.toBeInTheDocument();
    expect(screen.getByText('Actual content')).toBeInTheDocument();
  });

  it('handles empty segments array', () => {
    const props = {
      value: 'Some text content',
      segments: [],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('sorts segments by startOffset', () => {
    const props = {
      value: 'AAAA BBBB CCCC',
      segments: [
        { id: 2, startOffset: 5, endOffset: 9 },
        { id: 1, startOffset: 0, endOffset: 4 },
        { id: 3, startOffset: 10, endOffset: 14 },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    const component = renderer.create(<RenderClaimView {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });
});
