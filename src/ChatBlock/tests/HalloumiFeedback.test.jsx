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
    const checked = (claims) => ({
      ...defaultProps,
      halloumiMessage: 'Answer verified',
      markers: { claims },
    });

    const partial = {
      level: 'partial',
      sources: 4,
      chunk_sources: 3,
      snippet_sources: 1,
      note: '1 of 4 sources were search snippets, not full document text.',
    };

    it('names the affected claims instead of the plumbing', () => {
      render(
        <HalloumiFeedback
          {...checked([
            { score: 40, rationale: 'Not found', context_limited: true },
            { score: 40, rationale: 'Not found', context_limited: true },
            { score: 100, rationale: 'Found' },
          ])}
          contextQuality={partial}
        />,
      );
      expect(
        screen.getByText('Some sources could not be loaded in full.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/2 claims were checked against short excerpts/),
      ).toBeInTheDocument();
      // the backend note is an API diagnostic, not product copy
      expect(
        screen.queryByText(/search snippets, not full document text/),
      ).not.toBeInTheDocument();
    });

    it('agrees with the claim when only one was affected', () => {
      render(
        <HalloumiFeedback
          {...checked([
            { score: 40, rationale: 'Not found', context_limited: true },
          ])}
          contextQuality={partial}
        />,
      );
      expect(
        screen.getByText(/1 claim was checked against short excerpts/),
      ).toBeInTheDocument();
    });

    it('says plainly when no claim was affected', () => {
      render(
        <HalloumiFeedback
          {...checked([{ score: 100, rationale: 'Found' }])}
          contextQuality={partial}
        />,
      );
      expect(
        screen.getByText(/Every claim was still matched/),
      ).toBeInTheDocument();
    });

    it('stays quiet when every source was full chunk text', () => {
      render(
        <HalloumiFeedback
          {...checked([{ score: 40, rationale: 'Not found' }])}
          contextQuality={{
            level: 'full',
            sources: 3,
            chunk_sources: 3,
            snippet_sources: 0,
            note: null,
          }}
        />,
      );
      expect(
        screen.queryByText(/could not be loaded in full/),
      ).not.toBeInTheDocument();
    });

    it('stays quiet for backends that do not report context quality', () => {
      render(<HalloumiFeedback {...checked([{ score: 40 }])} />);
      expect(
        screen.queryByText(/could not be loaded in full/),
      ).not.toBeInTheDocument();
    });
  });
});
