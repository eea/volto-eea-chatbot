import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@testing-library/jest-dom/extend-expect';
import { ImageToolRenderer } from '../packets/renderers/ImageToolRenderer';
import { PacketType } from '../types/streamingModels';

describe('ImageToolRenderer', () => {
  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  it('renders generating state when not complete', () => {
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('renders complete state with images', () => {
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        {
          ind: 1,
          obj: {
            type: PacketType.IMAGE_GENERATION_TOOL_DELTA,
            images: [
              {
                file_id: 'img1',
                url: 'https://example.com/image1.png',
                revised_prompt: 'A beautiful landscape',
                shape: 'landscape',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders multiple images', () => {
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        {
          ind: 1,
          obj: {
            type: PacketType.IMAGE_GENERATION_TOOL_DELTA,
            images: [
              {
                file_id: 'img1',
                url: 'https://example.com/image1.png',
                revised_prompt: 'First image',
                shape: 'square',
              },
              {
                file_id: 'img2',
                url: 'https://example.com/image2.png',
                revised_prompt: 'Second image',
                shape: 'portrait',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles image without revised_prompt', () => {
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        {
          ind: 1,
          obj: {
            type: PacketType.IMAGE_GENERATION_TOOL_DELTA,
            images: [
              {
                file_id: 'img1',
                url: 'https://example.com/image1.png',
                revised_prompt: '',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles image without shape (defaults to square)', () => {
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        {
          ind: 1,
          obj: {
            type: PacketType.IMAGE_GENERATION_TOOL_DELTA,
            images: [
              {
                file_id: 'img1',
                url: 'https://example.com/image1.png',
                revised_prompt: 'Test',
              },
            ],
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty packets array', () => {
    const props = {
      packets: [],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<ImageToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('calls onComplete when section end is received', () => {
    const onComplete = jest.fn();
    const props = {
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete,
      children: mockChildRenderer,
    };

    act(() => {
      renderer.create(<ImageToolRenderer {...props} />);
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
