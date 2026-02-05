import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@testing-library/jest-dom/extend-expect';
import { FetchToolRenderer } from '../packets/renderers/FetchToolRenderer';
import { PacketType } from '../types/streamingModels';

describe('FetchToolRenderer', () => {
  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  it('renders fetching state when not complete', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.FETCH_TOOL_START,
            queries: ['search query'],
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('renders complete state', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.FETCH_TOOL_START,
            queries: ['search query'],
            documents: [
              {
                document_id: 'doc1',
                semantic_identifier: 'Document 1',
                link: 'https://example.com/1',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with multiple queries', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.FETCH_TOOL_START,
            queries: ['first query', 'second query', 'third query'],
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with multiple documents', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.FETCH_TOOL_START,
            queries: ['query'],
            documents: [
              { document_id: 'doc1' },
              { document_id: 'doc2' },
              { document_id: 'doc3' },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty queries and documents', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.FETCH_TOOL_START,
            queries: null,
            documents: null,
          },
        },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty packets array', () => {
    const props = {
      packets: [],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<FetchToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('calls onComplete when section end is received', () => {
    const onComplete = jest.fn();
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.FETCH_TOOL_START, queries: [] } },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete,
      children: mockChildRenderer,
    };

    act(() => {
      renderer.create(<FetchToolRenderer {...props} />);
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
