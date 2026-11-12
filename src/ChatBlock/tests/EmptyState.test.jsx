import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer from 'react-test-renderer';

import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import EmptyState, {
  click_signal,
} from '@eeacms/volto-eea-chatbot/ChatBlock/components/EmptyState';

const mockStore = configureStore();

describe('EmptyState', () => {
  let store;
  let onChoiceMock;

  beforeEach(() => {
    click_signal.current = null;
    store = mockStore({
      userSession: { token: '1234' },
      intl: { locale: 'en', messages: {} },
    });
    onChoiceMock = jest.fn();
  });

  function renderComponent(props) {
    return renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          <EmptyState {...props} />
        </MemoryRouter>
      </Provider>,
    );
  }

  it('renders with showAssistantPrompts and persona starter messages', () => {
    const props = {
      onChoice: onChoiceMock,
      showAssistantPrompts: true,
      enableStarterPrompts: false,
      starterPromptsHeading: 'Starter Prompts',
      persona: {
        starter_messages: [
          {
            name: 'Starter 1',
            description: 'Desc 1',
            message: 'Message 1',
          },
        ],
      },
    };

    const component = renderComponent(props);
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders with enableStarterPrompts and starterPrompts', () => {
    const props = {
      onChoice: onChoiceMock,
      showAssistantPrompts: false,
      enableStarterPrompts: true,
      starterPromptsHeading: 'Starter Prompts',
      starterPrompts: [
        {
          name: 'Prompt 1',
          description: 'Prompt Desc 1',
          message: 'Prompt Message 1',
        },
      ],
    };

    const component = renderComponent(props);
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders nothing when no starter messages and no starter prompts', () => {
    const props = {
      onChoice: onChoiceMock,
      showAssistantPrompts: true,
      enableStarterPrompts: false,
      persona: {
        starter_messages: [],
      },
    };

    const component = renderComponent(props);
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('renders without starterPromptsHeading', () => {
    const props = {
      onChoice: onChoiceMock,
      showAssistantPrompts: true,
      enableStarterPrompts: true,
      starterPrompts: [
        {
          name: 'Prompt X',
          description: 'Desc X',
          message: 'Message X',
        },
      ],
    };

    const component = renderComponent(props);
    expect(component.toJSON()).toMatchSnapshot();
  });

  it('calls onChoice when starter message button is clicked', () => {
    const props = {
      '@type': 'eeaChatbot',
      assistant: '17',
      chatTitle: 'Online public chat',
      height: '500px',
      onChoice: onChoiceMock,
      showAssistantDescription: true,
      showAssistantPrompts: true,
      showAssistantTitle: true,
      enableStarterPrompts: false,
      persona: {
        name: 'In enim justo rhoncus ut',
        description: 'Nullam dictum felis eu pede',
        starter_messages: [
          {
            description: 'Vestibulum purus quam scelerisque ut ',
            message: 'Nam at tortor in tellus',
            name: 'Curabitur at lacus ac velit',
          },
        ],
      },
    };

    const component = renderComponent(props);

    const button = component.root.findByProps({ className: 'starter-message' });

    button.props.onClick();

    expect(onChoiceMock).toHaveBeenCalledWith('Nam at tortor in tellus');
  });

  describe('enableGeneratedSeedQuestions', () => {
    let originalFetch;
    let mockStorage = {};

    beforeEach(() => {
      click_signal.current = null;
      originalFetch = global.fetch;
      mockStorage = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn((key) => mockStorage[key] || null),
          setItem: jest.fn((key, val) => {
            mockStorage[key] = val;
          }),
          removeItem: jest.fn((key) => {
            delete mockStorage[key];
          }),
        },
        writable: true,
      });
    });

    afterEach(() => {
      click_signal.current = null;
      global.fetch = originalFetch;
    });

    it('renders skeleton pills matching persona starter messages length while loading', () => {
      global.fetch = jest.fn(() => new Promise(() => {})); // Never resolves (stays loading)

      const props = {
        onChoice: onChoiceMock,
        enableGeneratedSeedQuestions: true,
        starterPromptsHeading: 'Suggested questions',
        persona: {
          starter_messages: [{ name: 'A' }, { name: 'B' }],
        },
      };

      let component;
      renderer.act(() => {
        component = renderComponent(props);
      });
      const skeletons = component.root.findAllByProps({
        className: 'starter-message starter-message-skeleton',
      });

      expect(skeletons).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        '/_rq/questions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            topics: [],
            count: 4,
          }),
        }),
      );
    });

    it('renders 4 skeleton pills when persona has no starter messages', () => {
      global.fetch = jest.fn(() => new Promise(() => {}));

      const props = {
        onChoice: onChoiceMock,
        enableGeneratedSeedQuestions: true,
        persona: {},
      };

      let component;
      renderer.act(() => {
        component = renderComponent(props);
      });
      const skeletons = component.root.findAllByProps({
        className: 'starter-message starter-message-skeleton',
      });

      expect(skeletons).toHaveLength(4);
    });

    it('passes qgenAsistantId and persona in POST body when defined', () => {
      global.fetch = jest.fn(() => new Promise(() => {}));

      const props = {
        onChoice: onChoiceMock,
        enableGeneratedSeedQuestions: true,
        qgenAsistantId: 24,
        seedQuestionsCount: 4,
        persona: { name: 'Climate-ADAPT', description: 'Adaptation platform' },
      };

      renderer.act(() => {
        renderComponent(props);
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/_rq/questions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantId: 24,
            topics: [],
            count: 4,
            persona: {
              name: 'Climate-ADAPT',
              description: 'Adaptation platform',
            },
          }),
        }),
      );
    });

    it('passes seedQuestionsTopics as object_list and seedQuestionsCount in POST body', () => {
      global.fetch = jest.fn(() => new Promise(() => {}));

      const props = {
        onChoice: onChoiceMock,
        enableGeneratedSeedQuestions: true,
        qgenAsistantId: 24,
        seedQuestionsTopics: [
          { topic: 'Biodiversity' },
          { topic: 'Freshwater rivers' },
        ],
        seedQuestionsCount: 6,
      };

      renderer.act(() => {
        renderComponent(props);
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/_rq/questions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantId: 24,
            topics: ['Biodiversity', 'Freshwater rivers'],
            count: 6,
          }),
        }),
      );
    });

    it('does not trigger a re-fetch when typing or changing topics in edit mode while questions are already present', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              questions: ['Initial Q1', 'Initial Q2'],
            }),
        }),
      );

      let component;
      await renderer.act(async () => {
        component = renderComponent({
          block: 'edit-block-1',
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          seedQuestionsTopics: [{ topic: 'A' }],
        });
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Simulate typing in sidebar on keystroke (updating seedQuestionsTopics)
      await renderer.act(async () => {
        component.update(
          <Provider store={store}>
            <MemoryRouter>
              <EmptyState
                block="edit-block-1"
                onChoice={onChoiceMock}
                enableGeneratedSeedQuestions={true}
                seedQuestionsTopics={[{ topic: 'AB' }]}
              />
            </MemoryRouter>
          </Provider>,
        );
      });

      // No new fetch must be triggered!
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('uses cached seed questions from localStorage on bootstrap without fetching', () => {
      global.fetch = jest.fn();

      const cachedKey = 'eea_seed_questions_default_test-block';
      mockStorage[cachedKey] = JSON.stringify({
        timestamp: Date.now(),
        questions: ['Cached Q1', 'Cached Q2'],
        topics: [],
      });

      let component;
      renderer.act(() => {
        component = renderComponent({
          block: 'test-block',
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
        });
      });

      expect(global.fetch).not.toHaveBeenCalled();

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });
      expect(buttons).toHaveLength(2);
      expect(
        buttons[0].findByProps({ className: 'starter-message-title' }).children,
      ).toEqual(['Cached Q1']);
    });

    it('re-generates seed questions when localStorage cache is expired, and saves new questions to localStorage', async () => {
      const cachedKey = 'eea_seed_questions_default_test-block';
      mockStorage[cachedKey] = JSON.stringify({
        timestamp: Date.now() - 100 * 60 * 1000, // 100 mins ago
        questions: ['Old Stale Q'],
        topics: [],
      });

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              questions: ['Fresh Q1', 'Fresh Q2'],
            }),
        }),
      );

      let component;
      await renderer.act(async () => {
        component = renderComponent({
          block: 'test-block',
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          seedQuestionsCacheMinutes: 60, // 60 mins TTL -> expired
        });
      });

      expect(global.fetch).toHaveBeenCalled();

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });
      expect(buttons).toHaveLength(2);
      expect(
        buttons[0].findByProps({ className: 'starter-message-title' }).children,
      ).toEqual(['Fresh Q1']);

      const saved = JSON.parse(mockStorage[cachedKey]);
      expect(saved.questions).toEqual(['Fresh Q1', 'Fresh Q2']);
    });

    it('resolves cacheKey using block_id when block is omitted', () => {
      global.fetch = jest.fn();

      const cachedKey = 'eea_seed_questions_default_my-block-id';
      mockStorage[cachedKey] = JSON.stringify({
        timestamp: Date.now(),
        questions: ['Cached by block_id'],
      });

      let component;
      renderer.act(() => {
        component = renderComponent({
          block_id: 'my-block-id',
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
        });
      });

      expect(global.fetch).not.toHaveBeenCalled();
      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });
      expect(buttons).toHaveLength(1);
      expect(
        buttons[0].findByProps({ className: 'starter-message-title' }).children,
      ).toEqual(['Cached by block_id']);
    });

    it('aborts fetch and sets empty questions when fetch times out', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn((url, opts) => {
        return new Promise((resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            reject(new Error('The user aborted a request.'));
          });
        });
      });

      let component;
      renderer.act(() => {
        component = renderComponent({
          block: 'timeout-block',
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          persona: { starter_messages: [{ name: 'Timeout Fallback' }] },
        });
      });

      await renderer.act(async () => {
        jest.advanceTimersByTime(15000);
      });

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });
      expect(buttons).toHaveLength(1);
      expect(
        buttons[0].findByProps({ className: 'starter-message-title' }).children,
      ).toEqual(['Timeout Fallback']);
      jest.useRealTimers();
    });

    it('renders generated questions and calls onChoice when clicked', async () => {
      click_signal.current = null;
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              questions: ['Generated Question 1', 'Generated Question 2'],
            }),
        }),
      );

      let component;
      await renderer.act(async () => {
        component = renderComponent({
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          persona: { starter_messages: [{ name: 'Fallback' }] },
        });
      });

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });

      expect(buttons).toHaveLength(2);
      const title = buttons[0].findByProps({
        className: 'starter-message-title',
      });
      expect(title.children).toEqual(['Generated Question 1']);

      buttons[0].props.onClick();
      expect(onChoiceMock).toHaveBeenCalledWith('Generated Question 1');
    });

    it('falls back to persona starter messages when fetch fails', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      let component;
      await renderer.act(async () => {
        component = renderComponent({
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          persona: {
            starter_messages: [
              { name: 'Fallback Prompt', message: 'Fallback Msg' },
            ],
          },
        });
      });

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });

      expect(buttons).toHaveLength(1);
      const title = buttons[0].findByProps({
        className: 'starter-message-title',
      });
      expect(title.children).toEqual(['Fallback Prompt']);
    });

    it('falls back to custom starter prompts when configured and fetch returns empty questions', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ questions: [] }),
        }),
      );

      let component;
      await renderer.act(async () => {
        component = renderComponent({
          onChoice: onChoiceMock,
          enableGeneratedSeedQuestions: true,
          enableStarterPrompts: true,
          starterPrompts: [{ name: 'Custom Prompt', message: 'Custom Msg' }],
        });
      });

      const buttons = component.root.findAllByProps({
        className: 'ui button starter-message',
      });

      expect(buttons).toHaveLength(1);
      const title = buttons[0].findByProps({
        className: 'starter-message-title',
      });
      expect(title.children).toEqual(['Custom Prompt']);
    });
  });
});
