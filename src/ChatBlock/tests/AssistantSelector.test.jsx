import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from 'react-intl';

import AssistantSelector from '@eeacms/volto-eea-chatbot/ChatBlock/components/AssistantSelector';

const personas = [
  { id: 34, name: 'Climate Assistant', description: '', tools: [] },
  { id: 29, name: 'Research Assistant', description: '', tools: [] },
  { id: 17, name: 'Briefing Assistant', description: '', tools: [] },
];

const renderSelector = (props = {}) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <AssistantSelector
        personas={personas}
        activeId={34}
        onSelect={jest.fn()}
        {...props}
      />
    </IntlProvider>,
  );

describe('AssistantSelector', () => {
  it('renders nothing when there is only one assistant to choose from', () => {
    renderSelector({ personas: [personas[0]] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when no assistant is available', () => {
    renderSelector({ personas: [] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the active assistant in the trigger', () => {
    renderSelector();
    expect(screen.getByRole('button')).toHaveTextContent('Climate Assistant');
  });

  it('lists every assistant in the configured order when opened', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button'));

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent.trim())).toEqual([
      'Climate Assistant',
      'Research Assistant',
      'Briefing Assistant',
    ]);
  });

  it('marks the active assistant as current', () => {
    renderSelector({ activeId: '29' });
    fireEvent.click(screen.getByRole('button'));

    const items = screen.getAllByRole('menuitem');
    expect(items[1]).toHaveTextContent('Research Assistant');
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[0]).not.toHaveAttribute('aria-current');
  });

  it('reports the chosen assistant', () => {
    const onSelect = jest.fn();
    renderSelector({ onSelect });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Briefing Assistant'));

    expect(onSelect).toHaveBeenCalledWith(personas[2]);
  });

  it('does nothing when the already active assistant is chosen', () => {
    const onSelect = jest.fn();
    renderSelector({ onSelect });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getAllByRole('menuitem')[0]);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('closes on Escape', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('closes when clicking outside', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);

    fireEvent.mouseDown(document.body);

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('cannot be opened while disabled', () => {
    renderSelector({ disabled: true });

    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
  it('closes its menu when a response starts streaming', () => {
    const { rerender } = renderSelector();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <AssistantSelector
          personas={personas}
          activeId={34}
          onSelect={jest.fn()}
          disabled
        />
      </IntlProvider>,
    );

    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
});
