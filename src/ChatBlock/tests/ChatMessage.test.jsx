import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer from 'react-test-renderer';

import '@testing-library/jest-dom';
import { Provider } from 'react-intl-redux';
import { ChatMessage } from '../chat/ChatMessage';

const mockStore = configureStore();

// Mock loadable components
jest.mock('@loadable/component', () => {
  const loadable = () => {
    const MockComponent = ({ children }) => <div>{children}</div>;
    return MockComponent;
  };
  loadable.lib = () => {
    const MockComponent = ({ children }) =>
      children ? children({ default: {} }) : null;
    return MockComponent;
  };
  return { __esModule: true, default: loadable };
});

describe('ChatMessage', () => {
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
          <ChatMessage {...props} />
        </MemoryRouter>
      </Provider>,
    );

  it('renders error message correctly', () => {
    const props = {
      message: {
        messageId: 3,
        type: 'error',
        error: 'Something went wrong',
      },
      libs: { remarkGfm: { default: [] } },
      isLoading: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('returns null for unknown message type', () => {
    const props = {
      message: {
        messageId: 4,
        message: 'Unknown type',
        type: 'unknown',
      },
      libs: { remarkGfm: { default: [] } },
      isLoading: false,
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toBeNull();
  });
});
