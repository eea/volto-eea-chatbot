import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import HalloumiFeedback from '@eeacms/volto-eea-chatbot/ChatBlock/components/HalloumiFeedback';

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/Spinner',
  () => () => <div data-testid="spinner">Loading...</div>,
);

jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon',
  () =>
    ({ name }) => <img src={name} alt="icon" />,
);

jest.mock('@eeacms/volto-eea-chatbot/icons/glasses.svg', () => 'glasses.svg');

jest.mock('@plone/volto-slate/editor/render', () => ({
  serializeNodes: (nodes) => {
    const visitTextNodes = (node) => {
      if (Array.isArray(node)) return node.map(visitTextNodes).join('');
      if (node && typeof node === 'object') {
        if (node.text) return node.text;
        if (node.children) return visitTextNodes(node.children);
      }
      return '';
    };
    return visitTextNodes(nodes);
  },
}));

describe('HalloumiFeedback', () => {
  const defaultProps = {
    halloumiMessage: null,
    isLoadingHalloumi: false,
    markers: { claims: [{ score: 50, rationale: 'Some rationale' }] },
    score: 75,
    scoreColor: 'green',
    onManualVerify: jest.fn(),
    showVerifyClaimsButton: false,
    sources: [],
  };

  it('renders fact-check button when showVerifyClaimsButton is true', () => {
    render(<HalloumiFeedback {...defaultProps} showVerifyClaimsButton />);
    const button = screen.getByRole('button', {
      name: /Fact-check AI answer/i,
    });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(defaultProps.onManualVerify).toHaveBeenCalled();
    expect(screen.getByText(/Please allow a few minutes/i)).toBeInTheDocument();
  });

  it('renders VerifyClaims message when loading and sources exist', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        isLoadingHalloumi
        sources={['doc1']}
        showVerifyClaimsButton
      />,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText(/Going through each claim/i)).toBeInTheDocument();
  });

  it('renders rationale message when no claims score', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={{ claims: [{ score: null, rationale: 'Failed to verify' }] }}
      />,
    );
    expect(screen.getByText('Failed to verify')).toBeInTheDocument();
  });

  it('renders halloumiMessage with score replaced', () => {
    const halloumiMessage = [
      { type: 'paragraph', children: [{ text: 'Score: {score}' }] },
    ];
    render(
      <HalloumiFeedback
        {...defaultProps}
        halloumiMessage={halloumiMessage}
        score={88}
      />,
    );
    expect(screen.getByText('Score: 88%')).toBeInTheDocument();
  });

  it('does not render anything extra when no special props', () => {
    render(<HalloumiFeedback {...defaultProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  describe('context quality', () => {
    const checked = {
      ...defaultProps,
      halloumiMessage: 'Answer verified',
      markers: {
        claims: [{ score: 40, rationale: 'Not found in the snippets' }],
      },
    };

    it('warns when the fact-checker only saw part of the sources', () => {
      render(
        <HalloumiFeedback
          {...checked}
          contextQuality={{
            level: 'partial',
            sources: 4,
            chunk_sources: 3,
            snippet_sources: 1,
            note: '1 of 4 sources were search snippets, not full document text.',
          }}
        />,
      );
      expect(screen.getByText('Partial context.')).toBeInTheDocument();
      expect(
        screen.getByText(/1 of 4 sources were search snippets/),
      ).toBeInTheDocument();
    });

    it('builds its own note when the backend sends none', () => {
      render(
        <HalloumiFeedback
          {...checked}
          contextQuality={{
            level: 'partial',
            sources: 2,
            chunk_sources: 0,
            snippet_sources: 2,
          }}
        />,
      );
      expect(
        screen.getByText(/2 of 2 sources were search snippets/),
      ).toBeInTheDocument();
    });

    it('stays quiet when every source was full chunk text', () => {
      render(
        <HalloumiFeedback
          {...checked}
          contextQuality={{
            level: 'full',
            sources: 3,
            chunk_sources: 3,
            snippet_sources: 0,
            note: null,
          }}
        />,
      );
      expect(screen.queryByText(/Partial context/)).not.toBeInTheDocument();
    });

    it('stays quiet for backends that do not report context quality', () => {
      render(<HalloumiFeedback {...checked} />);
      expect(screen.queryByText(/Partial context/)).not.toBeInTheDocument();
    });
  });
});
