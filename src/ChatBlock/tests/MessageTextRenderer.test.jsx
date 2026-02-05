import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { MessageTextRenderer } from '../packets/renderers/MessageTextRenderer';
import { PacketType } from '../types/streamingModels';

// Mock AudioContext
const mockClose = jest.fn();
global.AudioContext = jest.fn().mockImplementation(() => ({
  close: mockClose,
}));

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

describe('MessageTextRenderer', () => {
  const mockChildRenderer = (result) => (
    <div data-testid="renderer-result">
      <div data-testid="status">{result.status}</div>
      <div data-testid="content">{result.content}</div>
    </div>
  );

  const defaultMessage = {
    messageId: 1,
    nodeId: 1,
    message: 'Hello world',
    type: 'assistant',
    packets: [],
    files: [],
    toolCall: null,
    parentNodeId: null,
  };

  const defaultLibs = { remarkGfm: { default: [] } };

  it('renders message content without animation', () => {
    const packets = [
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          content: 'Hello',
          final_documents: null,
        },
      },
      { ind: 1, obj: { type: PacketType.MESSAGE_DELTA, content: ' world' } },
      { ind: 1, obj: { type: PacketType.MESSAGE_END } },
      { ind: 1, obj: { type: PacketType.STOP } },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MessageTextRenderer
          packets={packets}
          onComplete={jest.fn()}
          animate={false}
          stopPacketSeen={true}
          message={defaultMessage}
          libs={defaultLibs}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders blinking dot when no content and no packets', () => {
    const emptyMessage = { ...defaultMessage, message: '' };

    let component;
    act(() => {
      component = renderer.create(
        <MessageTextRenderer
          packets={[]}
          onComplete={jest.fn()}
          animate={false}
          stopPacketSeen={false}
          message={emptyMessage}
          libs={defaultLibs}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('calls onComplete when stream is finished', () => {
    const onComplete = jest.fn();
    const packets = [
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          content: 'Hi',
          final_documents: null,
        },
      },
      { ind: 1, obj: { type: PacketType.MESSAGE_END } },
      { ind: 1, obj: { type: PacketType.SECTION_END } },
    ];

    act(() => {
      renderer.create(
        <MessageTextRenderer
          packets={packets}
          onComplete={onComplete}
          animate={false}
          stopPacketSeen={true}
          message={defaultMessage}
          libs={defaultLibs}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('shows cursor when stream is not complete', () => {
    const packets = [
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          content: 'Starting...',
          final_documents: null,
        },
      },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MessageTextRenderer
          packets={packets}
          onComplete={jest.fn()}
          animate={false}
          stopPacketSeen={false}
          message={{ ...defaultMessage, message: 'Starting...' }}
          libs={defaultLibs}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders with remarkGfm plugin when available', () => {
    const packets = [
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          content: 'test',
          final_documents: null,
        },
      },
      { ind: 1, obj: { type: PacketType.MESSAGE_END } },
      { ind: 1, obj: { type: PacketType.STOP } },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MessageTextRenderer
          packets={packets}
          onComplete={jest.fn()}
          animate={false}
          stopPacketSeen={true}
          message={defaultMessage}
          libs={{ remarkGfm: { default: () => {} } }}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders with no remarkGfm', () => {
    const packets = [
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          content: 'test',
          final_documents: null,
        },
      },
      { ind: 1, obj: { type: PacketType.STOP } },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MessageTextRenderer
          packets={packets}
          onComplete={jest.fn()}
          animate={false}
          stopPacketSeen={true}
          message={defaultMessage}
          libs={{ remarkGfm: null }}
        >
          {mockChildRenderer}
        </MessageTextRenderer>,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });
});
