import { useState, useRef, useEffect } from 'react';
import type { ToolSnapshot } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { FormattedMessage } from 'react-intl';
import SVGIcon from './Icon';
import ChevronIcon from '@eeacms/volto-eea-chatbot/icons/chevron.svg';
import SlidersIcon from '@eeacms/volto-eea-chatbot/icons/sliders.svg';

interface McpToolSelectorProps {
  availableTools: ToolSnapshot[];
  selectedToolIds: number[];
  onToggleTool: (toolId: number) => void;
  disabled?: boolean;
}

export default function McpToolSelector({
  availableTools,
  selectedToolIds,
  onToggleTool,
  disabled = false,
}: McpToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!availableTools || availableTools.length === 0) {
    return null;
  }

  const selectedCount = selectedToolIds.filter((id) =>
    availableTools.some((t) => t.id === id),
  ).length;

  return (
    <div
      ref={containerRef}
      className={`mcp-tool-selector ${isOpen ? 'open' : ''}`}
    >
      <button
        type="button"
        className="mcp-tool-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="tool-trigger-icon" aria-hidden="true">
          <SVGIcon name={SlidersIcon} size={15} />
        </span>
        <span className="tool-trigger-label">
          <FormattedMessage
            id="Tools ({count})"
            defaultMessage="Tools ({count})"
            values={{ count: selectedCount }}
          />
        </span>
        <span
          className={`tool-trigger-chevron ${isOpen ? 'expanded' : ''}`}
          aria-hidden="true"
        >
          <SVGIcon name={ChevronIcon} size={14} />
        </span>
      </button>

      {isOpen && (
        <div className="mcp-tool-dropdown-menu" role="menu">
          <div className="mcp-tool-menu-header">
            <span>
              <FormattedMessage
                id="Tools & MCP Connectors"
                defaultMessage="Tools & MCP Connectors"
              />
            </span>
          </div>
          <div className="mcp-tool-menu-items">
            {availableTools.map((tool) => {
              const isChecked = selectedToolIds.includes(tool.id);
              const isMcp =
                tool.mcp_server_id !== null &&
                tool.mcp_server_id !== undefined;

              return (
                <label
                  key={tool.id}
                  className={`mcp-tool-menu-item ${isChecked ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={() => onToggleTool(tool.id)}
                  />
                  <div className="tool-item-info">
                    <div className="tool-item-title-row">
                      <span className="tool-item-name">
                        {tool.display_name || tool.name}
                      </span>
                      {isMcp && <span className="mcp-badge">MCP</span>}
                    </div>
                    {tool.description && (
                      <div className="tool-item-desc" title={tool.description}>
                        {tool.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
