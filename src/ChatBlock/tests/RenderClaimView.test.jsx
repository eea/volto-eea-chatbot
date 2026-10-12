import React from 'react';
import renderer from 'react-test-renderer';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RenderClaimView } from '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/RenderClaimView';

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

  it('renders each segment exactly at its offsets (no off-by-one)', () => {
    const props = {
      value: 'Alpha beta gamma',
      segments: [{ id: 1, startOffset: 6, endOffset: 10 }],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    render(<RenderClaimView {...props} />);
    const marks = document.querySelectorAll('.citation-highlight');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('beta1');
    const lines = [...document.querySelectorAll('.citation-line')].map(
      (l) => l.textContent,
    );
    expect(lines).toEqual(['Alpha ', ' gamma']);
  });

  it('does not duplicate text for overlapping segments', () => {
    // Two evidence quotes covering the same passage
    const props = {
      value: 'Alpha beta gamma delta',
      segments: [
        { id: 1, startOffset: 0, endOffset: 16 },
        { id: 2, startOffset: 6, endOffset: 22 },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    render(<RenderClaimView {...props} />);
    const marks = [...document.querySelectorAll('.citation-highlight')];
    expect(marks).toHaveLength(2);
    // segment 2 is clipped to what segment 1 did not already cover
    expect(marks[0].textContent).toBe('Alpha beta gamma1');
    expect(marks[1].textContent).toBe('delta2');
    expect(document.querySelectorAll('.citation-line')).toHaveLength(0);
  });

  it('registers refs of covered segments on the segment that covers them', () => {
    const spanRefs = createRef();
    const props = {
      value: 'Alpha beta gamma delta',
      segments: [
        { id: 1, startOffset: 0, endOffset: 22 },
        { id: 2, startOffset: 6, endOffset: 10 }, // fully inside segment 1
      ],
      sourceStartIndex: 0,
      visibleSegmentId: null,
      segmentContainerRef: createRef(),
      spanRefs,
    };

    render(<RenderClaimView {...props} />);
    expect(spanRefs.current[1]).toBe(spanRefs.current[2]);
    expect(spanRefs.current[2]).toBeInTheDocument();
  });

  it('renders several disjoint segments of one claim', () => {
    const props = {
      value: 'Alpha beta gamma delta epsilon',
      segments: [
        { id: 3, startOffset: 22, endOffset: 30 },
        { id: 1, startOffset: 0, endOffset: 5 },
        { id: 2, startOffset: 11, endOffset: 16 },
      ],
      sourceStartIndex: 0,
      visibleSegmentId: 2,
      segmentContainerRef: createRef(),
      spanRefs: createRef(),
    };

    render(<RenderClaimView {...props} />);
    const segments = document.querySelectorAll('.citation-segment');
    expect(segments).toHaveLength(3);
    expect(document.querySelectorAll('.citation-segment.active')).toHaveLength(
      1,
    );
  });
});
