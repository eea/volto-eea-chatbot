import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import AISearchInputView from '@eeacms/volto-eea-chatbot/AISearchInput/AISearchInputView';

const mockHistory = { push: jest.fn(), replace: jest.fn() };
jest.mock('react-router-dom', () => ({
  useHistory: () => mockHistory,
}));

jest.mock('@eeacms/volto-matomo/utils', () => ({
  trackEvent: jest.fn(),
}));

jest.mock(
  '@eeacms/volto-eea-chatbot/AISearchInput/components/IntroHeader',
  () => ({
    __esModule: true,
    default: ({ showIcon, blockTitle, introText }) => (
      <div data-testid="intro-header">
        {showIcon && <span data-testid="sparkle-icon">Icon</span>}
        {blockTitle && <span data-testid="block-title">{blockTitle}</span>}
        {introText && <span data-testid="intro-text">Intro</span>}
      </div>
    ),
  }),
);

jest.mock(
  '@eeacms/volto-eea-chatbot/AISearchInput/components/SearchInput',
  () => ({
    __esModule: true,
    default: ({ placeholderText, onSubmit, value, onChange, error }) => (
      <div data-testid="search-input">
        <input
          data-testid="input-field"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <button data-testid="submit-btn" onClick={onSubmit}>
          Submit
        </button>
        {error && (
          <div data-testid="input-error" role="alert">
            {error}
          </div>
        )}
      </div>
    ),
  }),
);

jest.mock(
  '@eeacms/volto-eea-chatbot/AISearchInput/components/DeepResearchToggle',
  () => ({
    __esModule: true,
    default: ({ mode, enabled, onChange }) => {
      if (mode === 'unavailable' || !mode) return null;
      if (mode === 'always_on') {
        return <div data-testid="deep-research-label">Deep research on</div>;
      }
      return (
        <div data-testid="deep-research-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => onChange(!enabled)}
          />
        </div>
      );
    },
  }),
);

jest.mock(
  '@eeacms/volto-eea-chatbot/AISearchInput/components/PromptChips',
  () => ({
    __esModule: true,
    default: ({ prompts, onSelect }) => (
      <div data-testid="prompt-chips">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            data-testid={`chip-${index}`}
            onClick={() => onSelect(prompt.message || prompt.label)}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    ),
  }),
);

jest.mock(
  '@eeacms/volto-eea-chatbot/AISearchInput/components/DisclaimerText',
  () => ({
    __esModule: true,
    default: ({ disclaimerText }) =>
      disclaimerText ? (
        <div data-testid="disclaimer">Disclaimer text</div>
      ) : null,
  }),
);

// Mock the styles import
jest.mock('@eeacms/volto-eea-chatbot/AISearchInput/styles.less', () => ({}));

describe('AISearchInputView', () => {
  const mockTrackEvent = require('@eeacms/volto-matomo/utils').trackEvent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHistory.push.mockReset();
    mockHistory.replace.mockReset();
    // Reset window.location mock
    delete window.location;
    window.location = {
      origin: 'http://localhost:3000',
      pathname: '/current-page',
      href: '',
    };
  });

  const defaultData = {
    assistantEndpoint: '/ai-assistant',
    placeholderText: 'Ask your question...',
    showIcon: true,
    deepResearch: 'unavailable',
    stylingVariant: 'dark',
    disclaimerText: [{ type: 'p', children: [{ text: 'Disclaimer' }] }],
  };

  it('renders input with placeholder', () => {
    render(<AISearchInputView data={defaultData} />);
    const input = screen.getByTestId('input-field');
    expect(input).toHaveAttribute('placeholder', 'Ask your question...');
  });

  it('renders submit button', () => {
    render(<AISearchInputView data={defaultData} />);
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders disclaimer', () => {
    render(<AISearchInputView data={defaultData} />);
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument();
  });

  it('renders intro header with icon when showIcon is true', () => {
    render(<AISearchInputView data={defaultData} />);
    expect(screen.getByTestId('sparkle-icon')).toBeInTheDocument();
  });

  it('renders intro header with block title', () => {
    render(
      <AISearchInputView
        data={{ ...defaultData, blockTitle: 'My Assistant' }}
      />,
    );
    expect(screen.getByTestId('block-title')).toHaveTextContent('My Assistant');
  });

  it('renders prompt chips when enabled', () => {
    const data = {
      ...defaultData,
      examplePromptsEnabled: true,
      examplePrompts: [{ label: 'Prompt 1' }, { label: 'Prompt 2' }],
    };
    render(<AISearchInputView data={data} />);
    expect(screen.getByTestId('prompt-chips')).toBeInTheDocument();
    expect(screen.getByTestId('chip-0')).toHaveTextContent('Prompt 1');
    expect(screen.getByTestId('chip-1')).toHaveTextContent('Prompt 2');
  });

  it('renders deep research toggle for user_on', () => {
    render(
      <AISearchInputView data={{ ...defaultData, deepResearch: 'user_on' }} />,
    );
    expect(screen.getByTestId('deep-research-toggle')).toBeInTheDocument();
  });

  it('renders deep research label for always_on', () => {
    render(
      <AISearchInputView
        data={{ ...defaultData, deepResearch: 'always_on' }}
      />,
    );
    expect(screen.getByTestId('deep-research-label')).toBeInTheDocument();
  });

  it('does NOT render toggle for unavailable', () => {
    render(
      <AISearchInputView
        data={{ ...defaultData, deepResearch: 'unavailable' }}
      />,
    );
    expect(
      screen.queryByTestId('deep-research-toggle'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('deep-research-label')).not.toBeInTheDocument();
  });

  it('submit navigates to correct URL with query param', () => {
    render(<AISearchInputView data={defaultData} />);
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'test question' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(mockHistory.push).toHaveBeenCalledWith(
      '/ai-assistant?query=test+question',
    );
  });

  it('submit appends deepResearch param when enabled', () => {
    render(
      <AISearchInputView data={{ ...defaultData, deepResearch: 'user_on' }} />,
    );
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(mockHistory.push).toHaveBeenCalledWith(
      '/ai-assistant?query=test&deepResearch=true',
    );
  });

  it('Enter key triggers submit', () => {
    render(<AISearchInputView data={defaultData} />);
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'enter question' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockHistory.push).toHaveBeenCalledWith(
      '/ai-assistant?query=enter+question',
    );
  });

  it('prompt chip click submits', () => {
    const data = {
      ...defaultData,
      examplePromptsEnabled: true,
      examplePrompts: [{ label: 'Chip', message: 'chip query' }],
    };
    render(<AISearchInputView data={data} />);
    fireEvent.click(screen.getByTestId('chip-0'));

    expect(mockHistory.push).toHaveBeenCalledWith(
      '/ai-assistant?query=chip+query',
    );
  });

  it('missing endpoint shows error', () => {
    render(
      <AISearchInputView data={{ ...defaultData, assistantEndpoint: '' }} />,
    );
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('input-error')).toBeInTheDocument();
    expect(mockHistory.push).not.toHaveBeenCalled();
  });

  it('styling variant class is applied', async () => {
    const { container } = render(<AISearchInputView data={defaultData} />);
    const root = container.querySelector('.ais-search-input');
    expect(root).toHaveClass('ais-dark');
  });

  it('Matomo event is tracked on submit', () => {
    render(<AISearchInputView data={defaultData} />);
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'tracked question' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(mockTrackEvent).toHaveBeenCalledWith({
      category: 'Chatbot',
      action: 'AI Search Input: Question submitted',
      name: 'tracked question',
    });
  });

  it('external URL uses window.location.href', () => {
    const data = {
      ...defaultData,
      assistantEndpoint: 'https://external.example.com/assistant',
    };
    render(<AISearchInputView data={data} />);
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: 'external' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(window.location.href).toContain(
      'https://external.example.com/assistant',
    );
    expect(mockHistory.push).not.toHaveBeenCalled();
  });

  it('does not submit empty query', () => {
    render(<AISearchInputView data={defaultData} />);
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(mockHistory.push).not.toHaveBeenCalled();
  });

  it('does not submit whitespace-only query', () => {
    render(<AISearchInputView data={defaultData} />);
    const input = screen.getByTestId('input-field');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(mockHistory.push).not.toHaveBeenCalled();
  });
});
