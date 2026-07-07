import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import PromptChips from '@eeacms/volto-eea-chatbot/AISearchInput/components/PromptChips';

describe('PromptChips', () => {
  it('renders correct number of chips', () => {
    const prompts = [
      { label: 'Chip 1' },
      { label: 'Chip 2' },
      { label: 'Chip 3' },
    ];
    const { container } = render(
      <PromptChips prompts={prompts} onSelect={jest.fn()} />,
    );
    const buttons = container.querySelectorAll('button.ais-chip');
    expect(buttons).toHaveLength(3);
  });

  it('each chip is a button element', () => {
    const prompts = [{ label: 'Chip' }];
    const { container } = render(
      <PromptChips prompts={prompts} onSelect={jest.fn()} />,
    );
    const button = container.querySelector('button.ais-chip');
    expect(button.tagName).toBe('BUTTON');
  });

  it('click triggers onSelect with message', () => {
    const mockOnSelect = jest.fn();
    const prompts = [{ label: 'Label', message: 'Actual message' }];
    render(<PromptChips prompts={prompts} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Label'));
    expect(mockOnSelect).toHaveBeenCalledWith('Actual message');
  });

  it('falls back to label when no message', () => {
    const mockOnSelect = jest.fn();
    const prompts = [{ label: 'Just label' }];
    render(<PromptChips prompts={prompts} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Just label'));
    expect(mockOnSelect).toHaveBeenCalledWith('Just label');
  });

  it('renders nothing for empty array', () => {
    const { container } = render(
      <PromptChips prompts={[]} onSelect={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for null prompts', () => {
    const { container } = render(
      <PromptChips prompts={null} onSelect={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for undefined prompts', () => {
    const { container } = render(<PromptChips onSelect={jest.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
