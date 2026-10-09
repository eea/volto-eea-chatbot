import React from 'react';
import renderer from 'react-test-renderer';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClaimModal } from '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/ClaimModal';

// Mock semantic-ui-react Modal
jest.mock('semantic-ui-react', () => ({
  Modal: ({ children, trigger, className }) => (
    <div className={className} data-testid="modal">
      <div data-testid="trigger">{trigger}</div>
      <div data-testid="content">{children}</div>
    </div>
  ),
  ModalHeader: ({ children }) => <div data-testid="header">{children}</div>,
  ModalContent: ({ children }) => (
    <div data-testid="modal-content">{children}</div>
  ),
}));

// Mock ClaimSegments
jest.mock(
  '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/ClaimSegments',
  () => ({
    ClaimSegments: () => <div data-testid="claim-segments">ClaimSegments</div>,
  }),
);

describe('ClaimModal', () => {
  const defaultProps = {
    claim: {
      score: 0.85,
      claimString: 'This is a claim about something important.',
      rationale: 'The claim is supported by multiple sources.',
      segmentIds: [1, 2, 3],
    },
    markers: {
      segments: {
        1: { id: 1, text: 'segment 1' },
        2: { id: 2, text: 'segment 2' },
        3: { id: 3, text: 'segment 3' },
      },
    },
    text: ['something important'],
    citedSources: [
      { id: 1, semantic_identifier: 'Source 1', link: 'https://example.com' },
    ],
  };

  it('renders the claim modal with high score', () => {
    const component = renderer.create(<ClaimModal {...defaultProps} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with low score', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        score: 0.3,
      },
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with medium score', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        score: 0.6,
      },
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles empty text array', () => {
    const props = {
      ...defaultProps,
      text: [],
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles claim with markdown formatting', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        claimString: '**Bold claim** with *italic* and [[1]](url)',
      },
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('renders with empty markers', () => {
    const props = {
      ...defaultProps,
      markers: {},
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles zero score', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        score: 0,
      },
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('handles perfect score', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        score: 1.0,
      },
    };
    const component = renderer.create(<ClaimModal {...props} />);
    const json = component.toJSON();
    expect(json).toMatchSnapshot();
  });

  it('labels a context-limited claim as unverified, not as a verdict', () => {
    const props = {
      ...defaultProps,
      claim: {
        ...defaultProps.claim,
        score: 0.4,
        context_limited: true,
      },
    };
    render(<ClaimModal {...props} />);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText("Couldn't be checked")).toBeInTheDocument();
    // the explanation lives once, at answer level - the modal says it in the
    // header and the badge already
    expect(
      screen.queryByText(/not evidence that the answer is wrong/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Not confirmed')).not.toBeInTheDocument();
  });

  it('names the verdict when the claim was checked against real text', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 0.4 },
    };
    render(<ClaimModal {...props} />);
    expect(
      screen.getByText('Not confirmed by the sources'),
    ).toBeInTheDocument();
    expect(screen.getByText('Not confirmed')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't be checked")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/not evidence that the answer is wrong/),
    ).not.toBeInTheDocument();
  });

  it('never titles a contradicted claim "Verified"', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 0.0 },
    };
    render(<ClaimModal {...props} />);
    expect(screen.getByText('Contradicted by the sources')).toBeInTheDocument();
    expect(screen.getByText('Contradicted')).toBeInTheDocument();
    expect(screen.queryByText('Verified Claim')).not.toBeInTheDocument();
  });

  it('titles a supported claim by its outcome', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 1.0 },
    };
    render(<ClaimModal {...props} />);
    expect(screen.getByText('Supported by the sources')).toBeInTheDocument();
    expect(screen.getByText('Supported')).toBeInTheDocument();
  });

  it('marks a discrete verdict position instead of a proportional bar', () => {
    const { container } = render(<ClaimModal {...defaultProps} />);
    const scale = container.querySelector('.verdict-scale');
    expect(scale).toHaveAttribute('data-verdict', 'supported');
    expect(scale.querySelectorAll('.verdict-step')).toHaveLength(3);
    // the old fill implied a probability the checker never measured
    expect(
      container.querySelector('.score-progress-fill'),
    ).not.toBeInTheDocument();
  });

  it('marks the contradicted position for a score of zero', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 0.0 },
    };
    const { container } = render(<ClaimModal {...props} />);
    expect(container.querySelector('.verdict-scale')).toHaveAttribute(
      'data-verdict',
      'contradicted',
    );
  });

  it('claims no position when the check ran over snippets only', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 0.4, context_limited: true },
    };
    const { container } = render(<ClaimModal {...props} />);
    expect(container.querySelector('.verdict-scale')).toHaveAttribute(
      'data-verdict',
      'unknown',
    );
  });
});
