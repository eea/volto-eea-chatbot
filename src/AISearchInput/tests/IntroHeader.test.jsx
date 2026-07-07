import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import IntroHeader from '@eeacms/volto-eea-chatbot/AISearchInput/components/IntroHeader';

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => ({
  __esModule: true,
  default: () => <svg data-testid="sparkle-icon" />,
}));

jest.mock('@eeacms/volto-eea-chatbot/icons/sparkle.svg', () => 'sparkle');

jest.mock('@plone/volto-slate/editor/render', () => ({
  serializeNodes: (nodes) => (
    <div data-testid="slate-content">{JSON.stringify(nodes)}</div>
  ),
}));

describe('IntroHeader', () => {
  it('renders icon when showIcon is true', () => {
    render(<IntroHeader showIcon={true} />);
    expect(screen.getByTestId('sparkle-icon')).toBeInTheDocument();
  });

  it('does not render icon when showIcon is false', () => {
    render(<IntroHeader showIcon={false} blockTitle="Title" />);
    expect(screen.queryByTestId('sparkle-icon')).not.toBeInTheDocument();
  });

  it('renders block title inline', () => {
    render(<IntroHeader blockTitle="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders intro text via serializeNodes', () => {
    const introText = [{ type: 'p', children: [{ text: 'Hello' }] }];
    render(<IntroHeader introText={introText} />);
    expect(screen.getByTestId('slate-content')).toBeInTheDocument();
  });

  it('renders nothing when all props are empty', () => {
    const { container } = render(<IntroHeader />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when all props are explicitly falsy', () => {
    const { container } = render(
      <IntroHeader showIcon={false} blockTitle="" introText={null} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
