import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { SourceChip } from '../components/SourceChip';

describe('SourceChip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with title only', () => {
    const component = renderer.create(<SourceChip title="Test Source" />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with icon', () => {
    const MockIcon = () => <span data-testid="mock-icon">Icon</span>;
    const component = renderer.create(
      <SourceChip title="Test Source" icon={<MockIcon />} />,
    );
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with remove button when onRemove is provided', () => {
    const onRemove = jest.fn();
    const component = renderer.create(
      <SourceChip title="Test Source" onRemove={onRemove} />,
    );
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<SourceChip title="Test Source" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = jest.fn();
    const onClick = jest.fn();
    render(
      <SourceChip title="Test Source" onRemove={onRemove} onClick={onClick} />,
    );

    const removeButton = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled(); // stopPropagation should prevent this
  });

  it('calls onRemove when Enter key is pressed on remove button', () => {
    const onRemove = jest.fn();
    render(<SourceChip title="Test Source" onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: /Remove/i });
    fireEvent.keyDown(removeButton, { key: 'Enter' });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not call onRemove when other keys are pressed', () => {
    const onRemove = jest.fn();
    render(<SourceChip title="Test Source" onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: /Remove/i });
    fireEvent.keyDown(removeButton, { key: 'Escape' });

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('applies animation class when includeAnimation is true', () => {
    render(<SourceChip title="Test Source" includeAnimation={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('animate-in');
  });

  it('removes animation class after timeout', () => {
    render(<SourceChip title="Test Source" includeAnimation={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('animate-in');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(button).not.toHaveClass('animate-in');
  });

  it('does not apply animation class when includeAnimation is false', () => {
    render(<SourceChip title="Test Source" includeAnimation={false} />);

    const button = screen.getByRole('button');
    expect(button).not.toHaveClass('animate-in');
  });
});
