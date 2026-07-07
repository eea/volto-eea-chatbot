import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchInput from '@eeacms/volto-eea-chatbot/AISearchInput/components/SearchInput';

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/Icon', () => ({
  __esModule: true,
  default: () => <svg data-testid="send-icon" />,
}));

jest.mock('@eeacms/volto-eea-chatbot/icons/send.svg', () => 'send');

describe('SearchInput', () => {
  const defaultProps = {
    placeholderText: 'Ask...',
    onSubmit: jest.fn(),
    value: '',
    onChange: jest.fn(),
    error: null,
  };

  it('renders input and submit button', () => {
    render(<SearchInput {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders with correct placeholder', () => {
    render(<SearchInput {...defaultProps} placeholderText="Type here..." />);
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Type here...',
    );
  });

  it('Enter key triggers onSubmit', () => {
    const mockOnSubmit = jest.fn();
    render(<SearchInput {...defaultProps} onSubmit={mockOnSubmit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('button click triggers onSubmit', () => {
    const mockOnSubmit = jest.fn();
    render(<SearchInput {...defaultProps} onSubmit={mockOnSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('onChange is called on input change', () => {
    const mockOnChange = jest.fn();
    render(<SearchInput {...defaultProps} onChange={mockOnChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    });
    expect(mockOnChange).toHaveBeenCalledWith('hello');
  });

  it('error renders below input', () => {
    render(<SearchInput {...defaultProps} error="Something went wrong" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('aria-invalid is set when error is present', () => {
    render(<SearchInput {...defaultProps} error="Error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('aria-invalid is not set when no error', () => {
    render(<SearchInput {...defaultProps} error={null} />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('does not trigger onSubmit for Enter with shiftKey', () => {
    const mockOnSubmit = jest.fn();
    render(<SearchInput {...defaultProps} onSubmit={mockOnSubmit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      shiftKey: true,
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
