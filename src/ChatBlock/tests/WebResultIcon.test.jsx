import React from 'react';
import renderer from 'react-test-renderer';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { WebResultIcon } from '../components/WebResultIcon';

describe('WebResultIcon', () => {
  it('renders favicon for valid URL', () => {
    const component = renderer.create(
      <WebResultIcon url="https://example.com" size={16} />,
    );
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with default size', () => {
    const component = renderer.create(
      <WebResultIcon url="https://example.com" />,
    );
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders FileIcon for invalid URL', () => {
    const component = renderer.create(
      <WebResultIcon url="invalid-url" size={16} />,
    );
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders GlobeIcon when favicon fails to load', () => {
    render(<WebResultIcon url="https://example.com" size={16} />);

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // After error, the component should re-render with GlobeIcon
    // The img should no longer be present
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('generates correct favicon URL', () => {
    render(<WebResultIcon url="https://www.google.com/search" size={20} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.google.com&size=128',
    );
  });

  it('applies correct size styles', () => {
    render(<WebResultIcon url="https://example.com" size={24} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('height', '24');
    expect(img).toHaveAttribute('width', '24');
    expect(img).toHaveStyle({ height: '24px', width: '24px' });
  });
});
