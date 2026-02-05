import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import renderer from 'react-test-renderer';

import '@testing-library/jest-dom/extend-expect';
import { Provider } from 'react-intl-redux';
import { UserMessage } from '../chat/UserMessage';

const mockStore = configureStore();

// Mock loadable components
jest.mock('@loadable/component', () => {
  return () => {
    const MockComponent = ({ children }) => <div>{children}</div>;
    return MockComponent;
  };
});

describe('UserMessage', () => {
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
          <UserMessage {...props} />
        </MemoryRouter>
      </Provider>,
    );

  it('renders user message with basic text', () => {
    const props = {
      message: {
        messageId: 1,
        message: 'Hello, this is my question',
        type: 'user',
      },
      libs: { remarkGfm: { default: [] } },
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders user message with custom className', () => {
    const props = {
      message: {
        messageId: 2,
        message: 'Another question',
        type: 'user',
      },
      libs: { remarkGfm: { default: [] } },
      className: 'most-recent',
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders user message without className', () => {
    const props = {
      message: {
        messageId: 4,
        message: 'Test message',
        type: 'user',
      },
      libs: { remarkGfm: { default: [] } },
    };

    const component = renderComponent(props);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });
});
