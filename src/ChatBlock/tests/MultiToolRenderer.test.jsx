import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { MultiToolRenderer } from '../packets/MultiToolRenderer';
import { PacketType } from '../types/streamingModels';

jest.mock('@loadable/component', () => {
  const loadable = () => {
    const MockComponent = ({ children }) => (
      <div data-testid="loadable">{children}</div>
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

// Mock SVGIcon
jest.mock('../components/Icon', () => {
  return ({ name, size }) => <span data-icon={name} data-size={size} />;
});

// Mock SVG imports
jest.mock('../../icons/done.svg', () => 'done-icon');
jest.mock('../../icons/chevron.svg', () => 'chevron-icon');

describe('MultiToolRenderer', () => {
  const defaultMessage = {
    messageId: 1,
    nodeId: 1,
    message: 'test',
    type: 'assistant',
    packets: [],
    files: [],
    toolCall: null,
    parentNodeId: null,
    isFinalMessageComing: false,
    isComplete: false,
  };

  const defaultLibs = { remarkGfm: { default: [] } };

  it('returns null when no tool groups match showTools filter', () => {
    const toolGroups = [
      {
        ind: 1,
        packets: [
          { ind: 1, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        ],
      },
    ];

    const component = renderer.create(
      <MultiToolRenderer
        toolGroups={toolGroups}
        showTools={[PacketType.SEARCH_TOOL_START]}
        message={defaultMessage}
        libs={defaultLibs}
      />,
    );
    expect(component.toJSON()).toBeNull();
  });

  it('returns null for empty tool groups', () => {
    const component = renderer.create(
      <MultiToolRenderer
        toolGroups={[]}
        message={defaultMessage}
        libs={defaultLibs}
      />,
    );
    expect(component.toJSON()).toBeNull();
  });

  it('renders search tool groups', () => {
    const toolGroups = [
      {
        ind: 1,
        packets: [
          { ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } },
          { ind: 1, obj: { type: PacketType.SECTION_END } },
        ],
      },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MultiToolRenderer
          toolGroups={toolGroups}
          showTools={[PacketType.SEARCH_TOOL_START]}
          message={defaultMessage}
          libs={defaultLibs}
        />,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders multiple tool groups', () => {
    const toolGroups = [
      {
        ind: 1,
        packets: [
          { ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } },
          { ind: 1, obj: { type: PacketType.SECTION_END } },
        ],
      },
      {
        ind: 2,
        packets: [
          { ind: 2, obj: { type: PacketType.SEARCH_TOOL_START } },
          { ind: 2, obj: { type: PacketType.SECTION_END } },
        ],
      },
    ];

    let component;
    act(() => {
      component = renderer.create(
        <MultiToolRenderer
          toolGroups={toolGroups}
          showTools={[PacketType.SEARCH_TOOL_START]}
          message={defaultMessage}
          libs={defaultLibs}
        />,
      );
    });
    expect(component.toJSON()).toMatchSnapshot();
  });
});
