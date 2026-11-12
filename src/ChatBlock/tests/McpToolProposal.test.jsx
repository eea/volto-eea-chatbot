import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import McpToolProposal from '../components/McpToolProposal';

const renderWithIntl = (component) => {
  return render(
    <IntlProvider locale="en" messages={{}}>
      {component}
    </IntlProvider>,
  );
};

describe('McpToolProposal', () => {
  const mockTool = {
    id: 10,
    name: 'data_connector',
    display_name: 'EEA Data Connector',
    description: 'Query EEA datasets',
    mcp_server_id: 1,
  };

  it('renders tool tag and use hint with centered svg icons', () => {
    const { container } = renderWithIntl(
      <McpToolProposal
        tool={mockTool}
        onAccept={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('@EEA Data Connector')).toBeInTheDocument();
    expect(screen.getByText('Use')).toBeInTheDocument();
    // Plus icon svg inside badge
    expect(
      container.querySelector('.proposal-plus-badge svg'),
    ).toBeInTheDocument();
    // Dismiss icon svg inside button
    expect(
      container.querySelector('.mcp-tool-proposal-dismiss svg'),
    ).toBeInTheDocument();
  });

  it('calls onAccept with tool when proposal button is clicked', () => {
    const onAccept = jest.fn();
    renderWithIntl(
      <McpToolProposal
        tool={mockTool}
        onAccept={onAccept}
        onDismiss={jest.fn()}
      />,
    );

    const btn = screen.getByRole('button', {
      name: /Enable @EEA Data Connector/i,
    });
    fireEvent.click(btn);
    expect(onAccept).toHaveBeenCalledWith(mockTool);
  });

  it('calls onDismiss with tool when dismiss button is clicked', () => {
    const onDismiss = jest.fn();
    renderWithIntl(
      <McpToolProposal
        tool={mockTool}
        onAccept={jest.fn()}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByRole('button', {
      name: /Dismiss suggestion/i,
    });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledWith(mockTool);
  });
});
