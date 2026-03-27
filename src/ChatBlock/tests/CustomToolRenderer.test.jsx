import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@testing-library/jest-dom';
import { CustomToolRenderer } from '../packets/renderers/CustomToolRenderer';
import { PacketType } from '../types/streamingModels';

describe('CustomToolRenderer', () => {
  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  it('renders running state when not complete', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'MyTool',
          },
        },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
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
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'Calculator',
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'Calculator',
            response_type: 'calculation_result',
            data: { result: 42 },
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with multiple deltas', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'MultiStepTool',
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'MultiStepTool',
            response_type: 'step1',
            data: { step: 1, status: 'processing' },
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'MultiStepTool',
            response_type: 'step2',
            data: { step: 2, status: 'complete' },
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles delta without response_type', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'SimpleTool',
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'SimpleTool',
            data: { result: 'done' },
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles delta without data', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'NoDataTool',
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'NoDataTool',
            response_type: 'status',
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('uses default tool name when not provided', () => {
    const props = {
      packets: [{ ind: 1, obj: { type: PacketType.SECTION_END } }],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty packets array', () => {
    const props = {
      packets: [],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('calls onComplete when section end is received', () => {
    const onComplete = jest.fn();
    const props = {
      packets: [
        {
          ind: 1,
          obj: { type: PacketType.CUSTOM_TOOL_START, tool_name: 'Test' },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete,
      children: mockChildRenderer,
    };

    act(() => {
      renderer.create(<CustomToolRenderer {...props} />);
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it('renders complex nested data correctly', () => {
    const props = {
      packets: [
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_START,
            tool_name: 'DataTool',
          },
        },
        {
          ind: 1,
          obj: {
            type: PacketType.CUSTOM_TOOL_DELTA,
            tool_name: 'DataTool',
            response_type: 'complex',
            data: {
              nested: {
                array: [1, 2, 3],
                object: { key: 'value' },
              },
            },
          },
        },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ],
      onComplete: jest.fn(),
      children: mockChildRenderer,
    };

    const component = renderer.create(<CustomToolRenderer {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });
});
