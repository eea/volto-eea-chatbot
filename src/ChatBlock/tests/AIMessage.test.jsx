import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer, { act } from 'react-test-renderer';

import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import {
  AIMessage,
  getContextSources,
  getFactCheckPhase,
  shouldShowVerifyClaimsButton,
} from '@eeacms/volto-eea-chatbot/ChatBlock/chat/AIMessage';
import { Tab, Sidebar } from 'semantic-ui-react';
import { RendererComponent } from '@eeacms/volto-eea-chatbot/ChatBlock/packets';

const mockStore = configureStore();

global.AudioContext = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
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
      onFeedback: jest.fn(),
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

  it('renders inline stop button when stopButton is message_loader, isLoading is true and isFinalMessageComing is true', () => {
    const mockCancel = jest.fn();
    const props = {
      message: {
        messageId: 1,
        message: 'Generating response...',
        type: 'assistant',
        isFinalMessageComing: true,
      },
      isLoading: true,
      isLastMessage: true,
      stopButton: 'message_loader',
      onCancel: mockCancel,
    };

    const component = renderComponent(props);
    const stopBtn = component.root.findByProps({
      className: 'inline-message-stop-btn',
    });
    expect(stopBtn).toBeDefined();
    act(() => {
      stopBtn.props.onClick();
    });
    expect(mockCancel).toHaveBeenCalled();
  });

  it('does not render inline stop button when isFinalMessageComing is false (loader in ChatWindow handles it)', () => {
    const mockCancel = jest.fn();
    const props = {
      message: {
        messageId: 1,
        message: 'Generating response...',
        type: 'assistant',
        isFinalMessageComing: false,
      },
      isLoading: true,
      isLastMessage: true,
      stopButton: 'message_loader',
      onCancel: mockCancel,
    };

    const component = renderComponent(props);
    const stopBtns = component.root.findAllByProps({
      className: 'inline-message-stop-btn',
    });
    expect(stopBtns.length).toBe(0);
  });

  describe('getContextSources', () => {
    const mockMessage = {
      toolCalls: [
        {
          tool_result: [
            { document_id: 'tool_doc_1', content: 'Tool doc 1 content' },
            { document_id: 'tool_doc_2', content: 'Tool doc 2 content' },
          ],
        },
      ],
    };

    const mockCitedSources = [
      {
        document_id: 'tool_doc_1',
        content: 'Cited doc 1 content',
      },
    ];

    it('defaults to cited sources when qualityCheckContext is undefined', () => {
      const result = getContextSources(mockMessage, mockCitedSources);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tool_doc_1');
    });

    it('returns cited sources when qualityCheckContext is citations', () => {
      const result = getContextSources(
        mockMessage,
        mockCitedSources,
        'citations',
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tool_doc_1');
    });

    it('returns all tool documents when qualityCheckContext is all', () => {
      const result = getContextSources(mockMessage, mockCitedSources, 'all');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tool_doc_1');
      expect(result[1].id).toBe('tool_doc_2');
    });

    it('reads the singular toolCall emitted by messageProcessor', () => {
      // messageProcessor.getMessage() returns `toolCall`; reading only the
      // plural made 'all' mode send zero sources.
      const v3Message = {
        toolCall: {
          tool_result: [
            { document_id: 'v3_doc_1', content: 'V3 doc 1' },
            { document_id: 'v3_doc_2', content: 'V3 doc 2' },
          ],
        },
      };
      const result = getContextSources(v3Message, [], 'all');
      expect(result).toHaveLength(2);
      expect(result.map((src) => src.id)).toEqual(['v3_doc_1', 'v3_doc_2']);
    });

    it('flags sources built from blurbs as snippets', () => {
      const result = getContextSources(mockMessage, mockCitedSources);
      expect(result[0].halloumiSource.kind).toBe('snippet');
    });
  });

  describe('getFactCheckPhase', () => {
    const base = {
      markers: null,
      qualityStatus: 'idle',
      requested: false,
      evidenceSettled: false,
      loading: false,
      qualityError: null,
    };

    it('names the evidence stage before the checker is even called', () => {
      expect(
        getFactCheckPhase({ ...base, requested: true, evidenceSettled: false }),
      ).toBe('resolving_evidence');
    });

    it('names the checking stage once the request is in flight', () => {
      expect(getFactCheckPhase({ ...base, loading: true })).toBe('checking');
    });

    it('treats a cancel as its own state, not as a failure', () => {
      expect(getFactCheckPhase({ ...base, qualityStatus: 'cancelled' })).toBe(
        'cancelled',
      );
    });

    it('prefers the verdict over everything once markers arrive', () => {
      expect(
        getFactCheckPhase({
          ...base,
          markers: { claims: [] },
          qualityError: { outcome: 'timeout' },
        }),
      ).toBe('verdict');
    });

    it('reports a failure only when nothing else explains the state', () => {
      expect(
        getFactCheckPhase({ ...base, qualityError: { outcome: 'busy' } }),
      ).toBe('failed');
    });

    it('is idle when nothing has been asked for', () => {
      expect(getFactCheckPhase(base)).toBe('idle');
    });
  });

  describe('shouldShowVerifyClaimsButton', () => {
    const base = {
      messageDisplayed: true,
      sourceCount: 3,
      markers: null,
      phase: 'idle',
      canRetry: true,
      qualityCheck: 'ondemand',
      qualityCheckEnabled: false,
    };

    it('shows the button for an on-demand answer', () => {
      expect(shouldShowVerifyClaimsButton(base)).toBe(true);
    });

    it('hides it while a check runs, because the strip says it instead', () => {
      expect(
        shouldShowVerifyClaimsButton({ ...base, phase: 'resolving_evidence' }),
      ).toBe(false);
      expect(shouldShowVerifyClaimsButton({ ...base, phase: 'checking' })).toBe(
        false,
      );
    });

    it('shows it again after a cancel', () => {
      expect(
        shouldShowVerifyClaimsButton({ ...base, phase: 'cancelled' }),
      ).toBe(true);
    });

    it('hides it once there is a verdict', () => {
      expect(
        shouldShowVerifyClaimsButton({ ...base, markers: { claims: [] } }),
      ).toBe(false);
    });

    it('hides it after a failure, where the error block owns the retry', () => {
      expect(shouldShowVerifyClaimsButton({ ...base, phase: 'failed' })).toBe(
        false,
      );
    });

    it('brings it back once the retry budget is spent', () => {
      expect(
        shouldShowVerifyClaimsButton({
          ...base,
          phase: 'failed',
          canRetry: false,
        }),
      ).toBe(true);
    });

    it('stays hidden when the automatic check is on', () => {
      expect(
        shouldShowVerifyClaimsButton({
          ...base,
          qualityCheck: 'ondemand_toggle',
          qualityCheckEnabled: true,
        }),
      ).toBe(false);
    });

    it('needs an answer with sources to check', () => {
      expect(
        shouldShowVerifyClaimsButton({ ...base, messageDisplayed: false }),
      ).toBe(false);
      expect(shouldShowVerifyClaimsButton({ ...base, sourceCount: 0 })).toBe(
        false,
      );
    });
  });
});
