import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import DeepResearchToggle from '@eeacms/volto-eea-chatbot/AISearchInput/components/DeepResearchToggle';

describe('DeepResearchToggle', () => {
  it('renders nothing for unavailable', () => {
    const { container } = render(
      <DeepResearchToggle
        mode="unavailable"
        enabled={false}
        onChange={jest.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for undefined mode', () => {
    const { container } = render(
      <DeepResearchToggle enabled={false} onChange={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders static label for always_on', () => {
    render(
      <DeepResearchToggle
        mode="always_on"
        enabled={true}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Deep research on')).toBeInTheDocument();
  });

  it('does not render checkbox for always_on', () => {
    render(
      <DeepResearchToggle
        mode="always_on"
        enabled={true}
        onChange={jest.fn()}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders checkbox for user_on', () => {
    render(
      <DeepResearchToggle mode="user_on" enabled={true} onChange={jest.fn()} />,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders checkbox for user_off', () => {
    render(
      <DeepResearchToggle
        mode="user_off"
        enabled={false}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('checkbox calls onChange with true when toggled on', () => {
    const mockOnChange = jest.fn();
    render(
      <DeepResearchToggle
        mode="user_on"
        enabled={false}
        onChange={mockOnChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('checkbox calls onChange with false when toggled off', () => {
    const mockOnChange = jest.fn();
    render(
      <DeepResearchToggle
        mode="user_on"
        enabled={true}
        onChange={mockOnChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mockOnChange).toHaveBeenCalledWith(false);
  });
});
