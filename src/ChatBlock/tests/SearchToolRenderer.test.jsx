import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@testing-library/jest-dom/extend-expect';
import { SearchToolRenderer } from '../packets/renderers/SearchToolRenderer';
import { PacketType } from '../types/streamingModels';

describe('SearchToolRenderer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  it('renders searching state for internal documents', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: false,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['test query'],
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    const component = renderer.create(<SearchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders searching state for internet search', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: true,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['web query'],
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    const component = renderer.create(<SearchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with search results', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: false,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['query'],
            documents: [
              {
                document_id: 'doc1',
                semantic_identifier: 'Document 1',
                link: 'https://example.com/1',
                source_type: 'file',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    let component;
    act(() => {
      component = renderer.create(<SearchToolRenderer {...props} />);
    });
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders empty state when no queries', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: false,
          },
        },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    const component = renderer.create(<SearchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('removes duplicate queries', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: false,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['duplicate', 'unique', 'duplicate'],
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    const component = renderer.create(<SearchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('removes duplicate documents by document_id', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: false,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['query'],
            documents: [
              { document_id: 'doc1', semantic_identifier: 'Doc 1' },
              { document_id: 'doc1', semantic_identifier: 'Doc 1 duplicate' },
              { document_id: 'doc2', semantic_identifier: 'Doc 2' },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    let component;
    act(() => {
      component = renderer.create(<SearchToolRenderer {...props} />);
    });
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles web results with favicon', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_START,
            is_internet_search: true,
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['web search'],
            documents: [
              {
                document_id: 'web1',
                semantic_identifier: 'Web Result',
                link: 'https://example.com/page',
                source_type: 'web',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    let component;
    act(() => {
      component = renderer.create(<SearchToolRenderer {...props} />);
    });
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty packets array', () => {
    const props = {
      packets: [],
      onComplete: jest.fn(),
      animate: false,
      children: mockChildRenderer,
    };

    const component = renderer.create(<SearchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('calls onComplete after animation delay when animate is true', () => {
    const onComplete = jest.fn();
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } },
        {
          ind: 1,
          obj: {
            type: PacketType.SEARCH_TOOL_DELTA,
            queries: ['query'],
            documents: [],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete,
      animate: true,
      children: mockChildRenderer,
    };

    act(() => {
      renderer.create(<SearchToolRenderer {...props} />);
    });

    // Initially not called
    expect(onComplete).not.toHaveBeenCalled();

    // Advance timers for the animation duration
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});
