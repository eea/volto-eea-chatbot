import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import withOnyxData from '../hocs/withOnyxData';

describe('withOnyxData', () => {
  it('shows loader initially', () => {
    const TestComponent = ({ data }) => <div>Data: {data}</div>;
    const callback = () => ['data', null, 'test'];
    const WrappedComponent = withOnyxData(callback)(TestComponent);

    render(<WrappedComponent />);

    // The Placeholder component should be rendered
    expect(screen.queryByText('Data:')).not.toBeInTheDocument();
  });

  it('renders component with fetched data', async () => {
    const TestComponent = ({ testData }) => <div>Data: {testData}</div>;
    const mockFetcher = Promise.resolve({ body: 'fetched value' });
    const callback = () => ['testData', mockFetcher, 'test-key'];
    const WrappedComponent = withOnyxData(callback)(TestComponent);

    render(<WrappedComponent />);

    await waitFor(() => {
      expect(screen.getByText('Data: fetched value')).toBeInTheDocument();
    });
  });

  it('passes original props to wrapped component', async () => {
    const TestComponent = ({ testData, originalProp }) => (
      <div>
        Data: {testData}, Original: {originalProp}
      </div>
    );
    const mockFetcher = Promise.resolve({ body: 'fetched value' });
    const callback = () => ['testData', mockFetcher, 'test-key'];
    const WrappedComponent = withOnyxData(callback)(TestComponent);

    render(<WrappedComponent originalProp="original value" />);

    await waitFor(() => {
      expect(
        screen.getByText('Data: fetched value, Original: original value'),
      ).toBeInTheDocument();
    });
  });

  it('handles null fetcher', async () => {
    const TestComponent = ({ data }) => <div>Data: {data || 'none'}</div>;
    const callback = () => ['data', null, 'test'];
    const WrappedComponent = withOnyxData(callback)(TestComponent);

    render(<WrappedComponent />);

    // Should stay in loading state
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText('Data: none')).not.toBeInTheDocument();
  });

  it('refetches when depKey changes', async () => {
    const TestComponent = ({ testData }) => <div>Data: {testData}</div>;
    let fetchCount = 0;
    const callback = (props) => {
      fetchCount++;
      const mockFetcher = Promise.resolve({ body: `value-${props.depKey}` });
      return ['testData', mockFetcher, props.depKey];
    };
    const WrappedComponent = withOnyxData(callback)(TestComponent);

    const { rerender } = render(<WrappedComponent depKey="key1" />);

    await waitFor(() => {
      expect(screen.getByText('Data: value-key1')).toBeInTheDocument();
    });

    rerender(<WrappedComponent depKey="key2" />);

    await waitFor(() => {
      expect(screen.getByText('Data: value-key2')).toBeInTheDocument();
    });
  });
});
