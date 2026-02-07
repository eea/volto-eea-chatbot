import React from 'react';
import renderer from 'react-test-renderer';
import { findRenderer, RendererComponent } from '../packets/RendererComponent';
import { PacketType } from '../types/streamingModels';

// Mock loadable
jest.mock('@loadable/component', () => {
  const loadable = (loader) => {
    const MockComponent = (props) => (
      <div data-testid="loadable">{props.children}</div>
    );
    return MockComponent;
  };
  loadable.lib = () => {
    const MockComponent = ({ children }) =>
      children ? children({ default: {} }) : null;
    return MockComponent;
  };
  return { __esModule: true, default: loadable };
});

describe('findRenderer', () => {
  it('returns MessageTextRenderer for chat packets', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.MESSAGE_START } }],
    });
    expect(result).toBeDefined();
    expect(result.name || result.displayName || '').toBeTruthy();
  });

  it('returns MessageTextRenderer for MESSAGE_DELTA', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.MESSAGE_DELTA } }],
    });
    expect(result).toBeDefined();
  });

  it('returns MessageTextRenderer for MESSAGE_END', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.MESSAGE_END } }],
    });
    expect(result).toBeDefined();
  });

  it('returns SearchToolRenderer for search packets', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } }],
    });
    expect(result).toBeDefined();
  });

  it('returns ImageToolRenderer for image packets', () => {
    const result = findRenderer({
      packets: [
        { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
      ],
    });
    expect(result).toBeDefined();
  });

  it('returns CustomToolRenderer for custom tool packets', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.CUSTOM_TOOL_START } }],
    });
    expect(result).toBeDefined();
  });

  it('returns FetchToolRenderer for fetch tool packets', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.FETCH_TOOL_START } }],
    });
    expect(result).toBeDefined();
  });

  it('returns ReasoningRenderer for reasoning packets', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.REASONING_START } }],
    });
    expect(result).toBeDefined();
  });

  it('returns ReasoningRenderer for REASONING_DELTA', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: PacketType.REASONING_DELTA } }],
    });
    expect(result).toBeDefined();
  });

  it('returns null for unknown packet types', () => {
    const result = findRenderer({
      packets: [{ ind: 1, obj: { type: 'unknown_type' } }],
    });
    expect(result).toBeNull();
  });

  it('returns null for empty packets', () => {
    const result = findRenderer({ packets: [] });
    expect(result).toBeNull();
  });
});

describe('RendererComponent', () => {
  const childRenderer = (result) => (
    <div>
      <span>{result.status}</span>
      <span>{result.content}</span>
    </div>
  );

  it('renders fallback for unrecognized packets', () => {
    const component = renderer.create(
      <RendererComponent
        packets={[{ ind: 1, obj: { type: 'unknown_type' } }]}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        libs={{ remarkGfm: { default: [] } }}
      >
        {childRenderer}
      </RendererComponent>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders fallback for empty packets', () => {
    const component = renderer.create(
      <RendererComponent
        packets={[]}
        onComplete={jest.fn()}
        animate={false}
        stopPacketSeen={false}
        libs={{ remarkGfm: { default: [] } }}
      >
        {childRenderer}
      </RendererComponent>,
    );
    expect(component.toJSON()).toMatchSnapshot();
  });
});
