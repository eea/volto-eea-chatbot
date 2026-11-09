import React from 'react';
import { FormattedMessage } from 'react-intl';
import type { ToolSnapshot } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

export interface McpToolProposalProps {
  tool: ToolSnapshot;
  onAccept: (tool: ToolSnapshot) => void;
  onDismiss: (tool: ToolSnapshot) => void;
}

export default function McpToolProposal({
  tool,
  onAccept,
  onDismiss,
}: McpToolProposalProps) {
  const toolName = (tool.display_name || tool.name || '').trim();

  return (
    <div
      className="mcp-tool-proposal-floating"
      role="region"
      aria-label="Suggested tool"
    >
      <button
        type="button"
        className="mcp-tool-proposal-btn"
        onClick={() => onAccept(tool)}
        aria-label={`Enable @${toolName}`}
      >
        <span className="proposal-plus-badge" aria-hidden="true">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span className="proposal-hint">
          <FormattedMessage id="Use" defaultMessage="Use" />
        </span>
        <span className="proposal-tool-tag">@{toolName}</span>
      </button>

      <button
        type="button"
        className="mcp-tool-proposal-dismiss"
        onClick={() => onDismiss(tool)}
        aria-label="Dismiss suggestion"
        title="Dismiss suggestion"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
