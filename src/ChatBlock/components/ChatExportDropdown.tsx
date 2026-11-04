import { useState, useRef, useEffect, useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import DownloadIcon from '@eeacms/volto-eea-chatbot/icons/download.svg';
import {
  exportConversationAsMarkdown,
  exportConversationAsPdf,
  exportConversationAsDocx,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/exportUtils';
import type {
  Message,
  Persona,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

export interface ChatExportDropdownProps {
  messages: Message[];
  persona?: Persona;
  disabled?: boolean;
  className?: string;
  hideWhenEmpty?: boolean;
}

export function ChatExportDropdown({
  messages,
  persona,
  disabled = false,
  className = '',
  hideWhenEmpty = true,
}: ChatExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const canExport = !disabled && hasMessages;

  const toggleDropdown = useCallback(() => {
    if (canExport) {
      setIsOpen((prev) => !prev);
    }
  }, [canExport]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  const handleExportMarkdown = () => {
    exportConversationAsMarkdown(messages, persona);
    closeDropdown();
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const docxLib = await import('docx');
      await exportConversationAsDocx(messages, persona, docxLib);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to export conversation as DOCX:', err);
    } finally {
      setIsExportingDocx(false);
      closeDropdown();
    }
  };

  const handleExportPdf = () => {
    closeDropdown();
    exportConversationAsPdf();
  };

  if (hideWhenEmpty && !hasMessages) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`chat-export-dropdown ${className} ${isOpen ? 'open' : ''}`}
    >
      <button
        type="button"
        className="chat-export-trigger icon-only"
        onClick={toggleDropdown}
        disabled={!canExport}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Export conversation"
        title="Export conversation"
      >
        <SVGIcon name={DownloadIcon} size={15} className="export-icon" />
      </button>

      {isOpen && (
        <div className="chat-export-menu" role="menu">
          <button
            type="button"
            className="chat-export-item"
            role="menuitem"
            onClick={handleExportMarkdown}
          >
            <span className="export-format-badge">MD</span>
            <span className="export-format-name">Markdown (.md)</span>
          </button>

          <button
            type="button"
            className="chat-export-item"
            role="menuitem"
            onClick={handleExportDocx}
            disabled={isExportingDocx}
          >
            <span className="export-format-badge">DOCX</span>
            <span className="export-format-name">
              {isExportingDocx ? (
                <FormattedMessage
                  id="Generating..."
                  defaultMessage="Generating..."
                />
              ) : (
                'Word (.docx)'
              )}
            </span>
          </button>

          <button
            type="button"
            className="chat-export-item"
            role="menuitem"
            onClick={handleExportPdf}
          >
            <span className="export-format-badge">PDF</span>
            <span className="export-format-name">PDF (.pdf)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatExportDropdown;
