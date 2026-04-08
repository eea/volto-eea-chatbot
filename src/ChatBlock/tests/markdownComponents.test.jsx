import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { components } from '@eeacms/volto-eea-chatbot/ChatBlock/components/markdown';

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/ClaimModal', () => ({
  ClaimModal: ({ text }) => <span data-testid="claim-modal">{text}</span>,
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/components/markdown/Citation', () => ({
  Citation: ({ value, children }) => (
    <span data-testid="citation">{value || children}</span>
  ),
}));

jest.mock('@eeacms/volto-eea-chatbot/ChatBlock/utils', () => ({
  transformEmailsToLinks: (text) => [text],
}));

const mockMessage = {
  messageId: 1,
  message: 'Hello',
  type: 'assistant',
};

describe('markdown components()', () => {
  let comps;

  beforeEach(() => {
    comps = components(mockMessage, null, []);
  });

  // ── table ──────────────────────────────────────────────
  describe('table', () => {
    it('renders table with ui celled table class', () => {
      const TableComp = comps.table;
      const { container } = render(
        <TableComp node={{}}>
          <tbody />
        </TableComp>,
      );
      expect(container.querySelector('table')).toHaveClass('ui', 'celled', 'table');
    });
  });

  // ── td ────────────────────────────────────────────────
  describe('td', () => {
    const TdComp = () => {
      const Td = components(mockMessage, null, []).td;
      return Td;
    };

    it('renders td with plain text children unchanged', () => {
      const Td = comps.td;
      const { container } = render(
        <table>
          <tbody>
            <tr>
              <Td node={{}}>plain text</Td>
            </tr>
          </tbody>
        </table>,
      );
      expect(container.querySelector('td')).toHaveTextContent('plain text');
    });

    it('replaces <br> strings with actual <br /> elements', () => {
      const Td = comps.td;
      const { container } = render(
        <table>
          <tbody>
            <tr>
              <Td node={{}}>{'line1<br>line2'}</Td>
            </tr>
          </tbody>
        </table>,
      );
      expect(container.querySelector('br')).toBeInTheDocument();
      expect(container.querySelector('td')).toHaveTextContent('line1line2');
    });

    it('handles multiple <br> replacements', () => {
      const Td = comps.td;
      const { container } = render(
        <table>
          <tbody>
            <tr>
              <Td node={{}}>{'a<br>b<br>c'}</Td>
            </tr>
          </tbody>
        </table>,
      );
      expect(container.querySelectorAll('br')).toHaveLength(2);
    });
  });

  // ── span ──────────────────────────────────────────────
  describe('span', () => {
    it('returns children when node child is not a text node', () => {
      const Span = comps.span;
      const node = { children: [{ type: 'element' }] };
      render(<Span node={node}>fallback</Span>);
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('returns children when no markers', () => {
      const Span = comps.span;
      const node = {
        children: [
          {
            type: 'text',
            value: 'some text',
            position: { start: { offset: 0 }, end: { offset: 9 } },
          },
        ],
      };
      render(<Span node={node}>some text</Span>);
      expect(screen.getByText('some text')).toBeInTheDocument();
    });

    it('returns plain text when markers exist but no claims match', () => {
      const markersWithClaims = { claims: [] };
      const compsWithMarkers = components(mockMessage, markersWithClaims, []);
      const Span = compsWithMarkers.span;
      const node = {
        children: [
          {
            type: 'text',
            value: 'unmatched text',
            position: { start: { offset: 0 }, end: { offset: 14 } },
          },
        ],
      };
      render(<Span node={node}>unmatched text</Span>);
      expect(screen.getByText('unmatched text')).toBeInTheDocument();
    });

    it('renders ClaimModal when text overlaps a claim', () => {
      const markers = {
        claims: [
          { score: 0.9, startOffset: 5, endOffset: 15 },
        ],
      };
      const compsWithMarkers = components(mockMessage, markers, []);
      const Span = compsWithMarkers.span;
      const node = {
        children: [
          {
            type: 'text',
            value: 'Hello World!!!',
            position: { start: { offset: 0 }, end: { offset: 14 } },
          },
        ],
      };
      const { container } = render(<span><Span node={node}>Hello World!!!</Span></span>);
      expect(container.querySelector('[data-testid="claim-modal"]')).toBeInTheDocument();
    });

    it('skips claims with null score', () => {
      const markers = {
        claims: [{ score: null, startOffset: 0, endOffset: 10 }],
      };
      const compsWithMarkers = components(mockMessage, markers, []);
      const Span = compsWithMarkers.span;
      const node = {
        children: [
          {
            type: 'text',
            value: 'no claim',
            position: { start: { offset: 0 }, end: { offset: 8 } },
          },
        ],
      };
      render(<span><Span node={node}>no claim</Span></span>);
      expect(screen.queryByTestId('claim-modal')).not.toBeInTheDocument();
    });
  });

  // ── a ─────────────────────────────────────────────────
  describe('a', () => {
    it('renders empty div for blinking dot (value starts with *)', () => {
      const A = comps.a;
      const { container } = render(
        <A node={{}} href="https://example.com">
          * dot
        </A>,
      );
      expect(container.querySelector('div')).toBeInTheDocument();
      expect(container.querySelector('a')).not.toBeInTheDocument();
    });

    it('renders Citation component for citation pattern [1]', () => {
      const A = comps.a;
      render(
        <A node={{}} href="https://example.com">
          [1]
        </A>,
      );
      expect(screen.getByTestId('citation')).toBeInTheDocument();
    });

    it('renders Citation component for citation pattern [42]', () => {
      const A = comps.a;
      render(
        <A node={{}} href="https://example.com">
          [42]
        </A>,
      );
      expect(screen.getByTestId('citation')).toBeInTheDocument();
    });

    it('renders regular anchor for normal links', () => {
      const A = comps.a;
      render(
        <A node={{}} href="https://example.com">
          Click here
        </A>,
      );
      expect(screen.getByText('Click here').tagName).toBe('A');
    });

    it('opens link in new tab on click', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const A = comps.a;
      render(
        <A node={{}} href="https://example.com">
          Click here
        </A>,
      );
      fireEvent.click(screen.getByText('Click here'));
      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank');
      openSpy.mockRestore();
    });

    it('handles click without href gracefully', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const A = comps.a;
      render(<A node={{}}>No href</A>);
      fireEvent.click(screen.getByText('No href'));
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('does not render Citation for non-matching bracket pattern', () => {
      const A = comps.a;
      render(
        <A node={{}} href="https://example.com">
          [not a number]
        </A>,
      );
      expect(screen.queryByTestId('citation')).not.toBeInTheDocument();
    });
  });

  // ── p ─────────────────────────────────────────────────
  describe('p', () => {
    it('renders paragraph with text-default class', () => {
      const P = comps.p;
      const { container } = render(<P node={{}}>Some text</P>);
      expect(container.querySelector('p')).toHaveClass('text-default');
    });

    it('transforms email strings to links', () => {
      const P = comps.p;
      render(<P node={{}}>Hello world</P>);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('passes through non-string children unchanged', () => {
      const P = comps.p;
      render(
        <P node={{}}>
          <strong>bold</strong>
        </P>,
      );
      expect(screen.getByText('bold')).toBeInTheDocument();
    });
  });
});
