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

  it('labels a context-limited claim as unverified rather than low', () => {
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
    expect(screen.getByText('Partial context')).toBeInTheDocument();
    expect(
      screen.getByText(/not evidence that the answer is wrong/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('keeps the normal label when the claim was checked against real text', () => {
    const props = {
      ...defaultProps,
      claim: { ...defaultProps.claim, score: 0.4 },
    };
    render(<ClaimModal {...props} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Verification')).toBeInTheDocument();
    expect(
      screen.queryByText(/not evidence that the answer is wrong/),
    ).not.toBeInTheDocument();
  });
});
