import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import McpToolSelector from '../components/McpToolSelector';

const renderWithIntl = (component) => {
  return render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );
};

describe('McpToolSelector', () => {
  const tools = [
    {
      id: 1,
      name: 'internal_search',
      display_name: 'Search',
      description: 'Search documentation',
    },
    {
      id: 10,
      name: 'data_connector',
      display_name: 'EEA Data Connector',
      description: 'Query EEA datasets',
      mcp_server_id: 1,
    },
  ];

  it('renders nothing when availableTools is empty', () => {
    const { container } = renderWithIntl(
      <McpToolSelector
        availableTools={[]}
        selectedToolIds={[]}
        onToggleTool={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger button with active tools count', () => {
    renderWithIntl(
      <McpToolSelector
        availableTools={tools}
        selectedToolIds={[1]}
        onToggleTool={jest.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Tools/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Tools (1)');
  });

  it('opens menu when trigger button is clicked and shows MCP badge', () => {
    renderWithIntl(
      <McpToolSelector
        availableTools={tools}
        selectedToolIds={[1]}
        onToggleTool={jest.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Tools/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('EEA Data Connector')).toBeInTheDocument();
    expect(screen.getByText('MCP')).toBeInTheDocument();
  });

  it('calls onToggleTool when checkbox is clicked', () => {
    const onToggle = jest.fn();
    renderWithIntl(
      <McpToolSelector
        availableTools={tools}
        selectedToolIds={[1]}
        onToggleTool={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Tools/i }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // id 1
    expect(checkboxes[1]).not.toBeChecked(); // id 10

    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith(10);
  });

  it('keeps internal search tool checked and disabled (untoggleable)', () => {
    const onToggle = jest.fn();
    renderWithIntl(
      <McpToolSelector
        availableTools={tools}
        selectedToolIds={[1]}
        onToggleTool={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Tools/i }));

    const searchCheckbox = screen.getAllByRole('checkbox')[0];
    expect(searchCheckbox).toBeChecked();
    expect(searchCheckbox).toBeDisabled();

    fireEvent.click(searchCheckbox);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('closes menu when Escape is pressed', () => {
    renderWithIntl(
      <McpToolSelector
        availableTools={tools}
        selectedToolIds={[1]}
        onToggleTool={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Tools/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
