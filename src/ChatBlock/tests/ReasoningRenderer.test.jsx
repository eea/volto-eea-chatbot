import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ReasoningRenderer } from '../packets/renderers/ReasoningRenderer';
import { PacketType } from '../types/streamingModels';

jest.mock('@loadable/component', () => {
  const loadable = () => {
    const MockMarkdown = ({ children }) => (
      <div data-testid="markdown">{children}</div>
    );
    return MockMarkdown;
  };
  loadable.lib = () => {
    const MockComponent = ({ children }) =>
      children ? children({ default: {} }) : null;
    return MockComponent;
  };
  return { __esModule: true, default: loadable };
});

describe('ReasoningRenderer', () => {
  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  const defaultMessage = {
    messageId: 1,
    nodeId: 1,
    message: 'test',
    type: 'assistant',
    packets: [],
    files: [],
    toolCall: null,
    parentNodeId: null,
  };

  const defaultLibs = { remarkGfm: { default: [] } };

  it('renders empty content when no packets', () => {
    const component = renderer.create(
      <ReasoningRenderer
        packets={[]}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        message={defaultMessage}
        libs={defaultLibs}
      >
        {mockChildRenderer}
      </ReasoningRenderer>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders thinking status when reasoning has started', () => {
    const packets = [
      { ind: 1, obj: { type: PacketType.REASONING_START } },
      {
        ind: 1,
        obj: { type: PacketType.REASONING_DELTA, reasoning: 'Let me think...' },
      },
    ];

    const component = renderer.create(
      <ReasoningRenderer
        packets={packets}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        message={defaultMessage}
        libs={defaultLibs}
      >
        {mockChildRenderer}
      </ReasoningRenderer>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('calls onComplete when reasoning ends without animation', () => {
    const onComplete = jest.fn();
    const packets = [
      { ind: 1, obj: { type: PacketType.REASONING_START } },
      {
        ind: 1,
        obj: { type: PacketType.REASONING_DELTA, reasoning: 'Thinking...' },
      },
      { ind: 1, obj: { type: PacketType.SECTION_END } },
    ];

    act(() => {
      renderer.create(
        <ReasoningRenderer
          packets={packets}
          onComplete={onComplete}
          animate={false}
          stopPacketSeen={false}
          message={defaultMessage}
          libs={defaultLibs}
        >
          {mockChildRenderer}
        </ReasoningRenderer>,
      );
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('renders with REASONING_END packet type', () => {
    const packets = [
      { ind: 1, obj: { type: PacketType.REASONING_START } },
      {
        ind: 1,
        obj: { type: PacketType.REASONING_DELTA, reasoning: 'Analysis' },
      },
      { ind: 1, obj: { type: PacketType.REASONING_END } },
    ];

    const component = renderer.create(
      <ReasoningRenderer
        packets={packets}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        message={defaultMessage}
        libs={defaultLibs}
      >
        {mockChildRenderer}
      </ReasoningRenderer>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('concatenates multiple reasoning deltas', () => {
    const packets = [
      { ind: 1, obj: { type: PacketType.REASONING_START } },
      {
        ind: 1,
        obj: { type: PacketType.REASONING_DELTA, reasoning: 'First ' },
      },
      {
        ind: 1,
        obj: { type: PacketType.REASONING_DELTA, reasoning: 'second' },
      },
    ];

    const component = renderer.create(
      <ReasoningRenderer
        packets={packets}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        message={defaultMessage}
        libs={defaultLibs}
      >
        {mockChildRenderer}
      </ReasoningRenderer>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });
});
