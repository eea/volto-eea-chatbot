import React from 'react';
import renderer from 'react-test-renderer';
import '@testing-library/jest-dom/extend-expect';
import { ClaimModal } from '../components/markdown/ClaimModal';

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
jest.mock('../components/markdown/ClaimSegments', () => ({
  ClaimSegments: () => <div data-testid="claim-segments">ClaimSegments</div>,
}));

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
});
