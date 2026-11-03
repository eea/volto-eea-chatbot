import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import DeepResearchButton from '../components/DeepResearchButton';

const renderWithIntl = (component) => {
  return render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );
};

describe('DeepResearchButton', () => {
  it('renders correctly in inactive state', () => {
    renderWithIntl(<DeepResearchButton enabled={false} onToggle={jest.fn()} />);

    const button = screen.getByRole('switch', { name: 'Deep research' });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveClass('active');
    expect(button).toHaveAttribute('aria-checked', 'false');
  });

  it('renders correctly in active state', () => {
    renderWithIntl(<DeepResearchButton enabled={true} onToggle={jest.fn()} />);

    const button = screen.getByRole('switch', { name: 'Deep research' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('active');
    expect(button).toHaveAttribute('aria-checked', 'true');
  });

  it('triggers onToggle callback on click', () => {
    const mockToggle = jest.fn();
    renderWithIntl(
      <DeepResearchButton enabled={false} onToggle={mockToggle} />,
    );

    const button = screen.getByRole('switch', { name: 'Deep research' });
    fireEvent.click(button);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('renders "Deep research on" when alwaysOn is true', () => {
    const mockToggle = jest.fn();
    renderWithIntl(
      <DeepResearchButton
        enabled={true}
        alwaysOn={true}
        onToggle={mockToggle}
      />,
    );

    const button = screen.getByRole('switch', { name: 'Deep research on' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('always-on');
    expect(screen.getByText('Deep research on')).toBeInTheDocument();

    fireEvent.click(button);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('does not trigger onToggle when disabled', () => {
    const mockToggle = jest.fn();
    renderWithIntl(
      <DeepResearchButton
        enabled={false}
        disabled={true}
        onToggle={mockToggle}
      />,
    );

    const button = screen.getByRole('switch', { name: 'Deep research' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockToggle).not.toHaveBeenCalled();
  });
});
