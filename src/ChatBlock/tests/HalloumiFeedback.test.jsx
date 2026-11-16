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
jest.mock('@eeacms/volto-eea-chatbot/icons/rotate.svg', () => 'rotate.svg');

// A formatter small enough to read, but real enough to exercise the plural and
// variable interpolation the component actually relies on.
const format = (msg, vars = {}) => {
  let out = msg.defaultMessage;
  out = out.replace(
    /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g,
    (_, key, one, other) =>
      (vars[key] === 1 ? one : other).replace('#', vars[key]),
  );
  out = out.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
  return out;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: format }),
  defineMessages: (m) => m,
}));

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
    markers: { claims: [{ score: 50, rationale: 'Some rationale' }] },
    score: 75,
    scoreColor: 'green',
    onManualVerify: jest.fn(),
    showVerifyClaimsButton: false,
    retryHalloumi: jest.fn(),
    phase: 'idle',
    sourceCount: 0,
    error: null,
    canRetry: true,
    onCancelCheck: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onManualVerify.mockClear();
    defaultProps.retryHalloumi.mockClear();
    defaultProps.onCancelCheck.mockClear();
  });

  it('renders an enabled fact-check button when idle', () => {
    render(<HalloumiFeedback {...defaultProps} showVerifyClaimsButton />);
    const button = screen.getByRole('button', {
      name: /Fact-check AI answer/i,
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(defaultProps.onManualVerify).toHaveBeenCalled();
    expect(screen.getByText(/Please allow a few minutes/i)).toBeInTheDocument();
  });

  it('steps the button aside while a check runs', () => {
    // AIMessage stops asking for the button once a check starts: the strip
    // below already says "Checking this answer against 3 sources", and a second
    // "Fact-checking…" in the button said the same thing twice.
    render(
      <HalloumiFeedback
        {...defaultProps}
        showVerifyClaimsButton={false}
        phase="checking"
        sourceCount={3}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Fact-check AI answer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Checking this answer against 3 sources…'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('shows the progress strip while documents are being resolved', () => {
    // Regression: the evidence fetch used to render nothing at all, so clicking
    // Fact-check looked like a dead button for several seconds.
    render(
      <HalloumiFeedback
        {...defaultProps}
        showVerifyClaimsButton
        phase="resolving_evidence"
        sourceCount={4}
      />,
    );
    // the strip is the only thing spinning now
    expect(document.querySelectorAll('.fact-check-spinner').length).toBe(1);
    expect(
      screen.getByText('Gathering the cited documents…'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Checking this answer against 4 sources…'),
    ).not.toBeInTheDocument();
  });

  it('names the source count while checking, and announces it', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        showVerifyClaimsButton
        phase="checking"
        sourceCount={1}
      />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Checking this answer against 1 source…');
  });

  it('lets the user cancel a running check', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        showVerifyClaimsButton
        phase="checking"
        sourceCount={2}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onCancelCheck).toHaveBeenCalled();
  });

  it('says the service is unavailable, and offers a cooled-down retry', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={null}
        phase="failed"
        error={{ outcome: 'unreachable' }}
      />,
    );
    expect(
      screen.getByText('Fact-checking is temporarily unavailable.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The answer is unchanged - only the verification failed.',
      ),
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /Retry available in/i });
    expect(retry).toBeDisabled();
  });

  it('distinguishes a too-long check from an outage', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={null}
        phase="failed"
        error={{ outcome: 'timeout' }}
      />,
    );
    expect(
      screen.getByText('Fact-checking took too long for this answer.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/more text than can be verified in one pass/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Fact-checking is temporarily unavailable.'),
    ).not.toBeInTheDocument();
  });

  it('distinguishes a busy checker from an outage', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={null}
        phase="failed"
        error={{ outcome: 'busy' }}
      />,
    );
    expect(
      screen.getByText('Fact-checking is busy right now.'),
    ).toBeInTheDocument();
  });

  it('does not offer a retry when there were no sources to check', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={null}
        phase="failed"
        error={{ outcome: 'no_sources' }}
      />,
    );
    expect(
      screen.getByText('There are no sources to check this answer against.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull();
  });

  it('stops offering retries once the attempt cap is reached', () => {
    render(
      <HalloumiFeedback
        {...defaultProps}
        markers={null}
        phase="failed"
        error={{ outcome: 'unreachable' }}
        canRetry={false}
      />,
    );
    expect(
      screen.getByText(
        'Fact-checking is unavailable right now. Please try again later.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull();
  });

  it('renders the verdict message with the score replaced', () => {
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

  it('renders nothing extra when idle with no markers', () => {
    render(<HalloumiFeedback {...defaultProps} markers={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.fact-check-spinner')).toHaveLength(0);
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
