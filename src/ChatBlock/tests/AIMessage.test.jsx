import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer, { act } from 'react-test-renderer';

import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import { AIMessage } from '@eeacms/volto-eea-chatbot/ChatBlock/chat/AIMessage';
import { Tab, Sidebar } from 'semantic-ui-react';
import { RendererComponent } from '@eeacms/volto-eea-chatbot/ChatBlock/packets';

const mockStore = configureStore();

global.AudioContext = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
}));

describe('AIMessage', () => {
  let store;

  beforeEach(() => {
    store = mockStore({
      userSession: { token: '1234' },
      intl: { locale: 'en', messages: {} },
    });
  });

  const renderComponent = (props) =>
    renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          <AIMessage {...props} />
        </MemoryRouter>
      </Provider>,
    );

  it('renders AI message with content', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Hello, I am an AI assistant',
        type: 'assistant',
      },
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders AI message with sources', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Here is some information',
        type: 'assistant',
        documents: [
          {
            document_id: 'doc1',
            semantic_identifier: 'Source 1',
            link: 'https://example.com/1',
            source_type: 'web',
          },
        ],
      },
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders AI message with feedback options', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'This is a response',
        type: 'assistant',
      },
      onFeedback: vi.fn(),
      enableFeedback: true,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders empty AI message', () => {
    const props = {
      message: {
        messageId: 1,
        message: '',
        type: 'assistant',
      },
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles tab change and sources sidebar interactions', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Hello [1] details',
        type: 'assistant',
        citations: { 1: 'doc1', 2: 'doc2', 3: 'doc3', 4: 'doc4' },
        documents: [
          {
            document_id: 'doc1',
            semantic_identifier: 'Source 1',
            link: 'https://example.com/1',
            source_type: 'web',
            index: '1',
          },
          {
            document_id: 'doc2',
            semantic_identifier: 'Source 2',
            link: 'https://example.com/2',
            source_type: 'web',
            index: '2',
          },
          {
            document_id: 'doc3',
            semantic_identifier: 'Source 3',
            link: 'https://example.com/3',
            source_type: 'web',
            index: '3',
          },
          {
            document_id: 'doc4',
            semantic_identifier: 'Source 4',
            link: 'https://example.com/4',
            source_type: 'web',
            index: '4',
          },
        ],
        displayPackets: [0],
        groupedPackets: [
          {
            ind: 0,
            packets: [
              {
                ind: 0,
                obj: { type: 'message_start', content: 'Hello [1] details' },
              },
            ],
          },
        ],
      },
      libs: {
        remarkGfm: {},
        rehypeRaw: {},
        remarkMath: {},
        rehypeKatex: {},
      },
      qualityCheck: 'disabled',
    };

    const component = renderComponent(props);

    // Find and trigger RendererComponent's onComplete to set messageDisplayed to true
    const rendererComp = component.root.findByType(RendererComponent);
    act(() => {
      rendererComp.props.onComplete();
    });

    // Find semantic-ui-react Tab component
    const tabComponent = component.root.findByType(Tab);
    expect(tabComponent).toBeDefined();

    // Simulate tab change
    act(() => {
      tabComponent.props.onTabChange(null, { activeIndex: 1 });
    });

    // Toggle tab back
    act(() => {
      tabComponent.props.onTabChange(null, { activeIndex: 0 });
    });

    // Find "See all sources" button (sources.length > 3)
    const showAllBtn = component.root.findByProps({
      className: 'source show-all-sources-btn',
    });
    expect(showAllBtn).toBeDefined();

    // Click button to open the sidebar
    act(() => {
      showAllBtn.props.onClick();
    });

    // Verify Sidebar is visible
    const sidebar = component.root.findByType(Sidebar);
    expect(sidebar.props.visible).toBe(true);

    // Click close button inside sidebar header
    const closeBtn = sidebar.findByProps({ basic: true });
    act(() => {
      closeBtn.props.onClick();
    });

    // Verify Sidebar is closed or calls onHide
    act(() => {
      sidebar.props.onHide();
    });
  });
});
