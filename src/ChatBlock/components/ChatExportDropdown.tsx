import { useState, useRef, useEffect, useCallback } from 'react';
import { FormattedMessage, useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import DownloadIcon from '@eeacms/volto-eea-chatbot/icons/download.svg';
import CopyIcon from '@eeacms/volto-eea-chatbot/icons/copy.svg';
import CheckIcon from '@eeacms/volto-eea-chatbot/icons/check.svg';
import {
  exportConversationAsMarkdown,
  exportConversationAsPdf,
  exportConversationAsDocx,
  exportConversationAsHtml,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/exportUtils';
import { copyShareLink } from '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService';
import type {
  Message,
  Persona,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

export interface ChatExportDropdownProps {
  messages: Message[];
  persona?: Persona;
  chatSessionId?: string | null;
  disabled?: boolean;
  className?: string;
  hideWhenEmpty?: boolean;
}

const messagesI18n = defineMessages({
  exportConversation: {
    id: 'Export conversation',
    defaultMessage: 'Export conversation',
  },
  exportOrShareConversation: {
    id: 'Export or share conversation',
    defaultMessage: 'Export or share conversation',
  },
});

export function ChatExportDropdown({
  messages,
  persona,
  chatSessionId,
  disabled = false,
  className = '',
  hideWhenEmpty = true,
}: ChatExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intl = useIntl();

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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

  const handleExportHtml = () => {
    closeDropdown();
    exportConversationAsHtml(messages, persona);
  };

  const handleCopyLink = async () => {
    if (!chatSessionId) return;
    const ok = await copyShareLink(chatSessionId);
    if (ok) {
      setIsCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        closeDropdown();
      }, 1500);
    }
  };

  if (hideWhenEmpty && !hasMessages) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`chat-export-dropdown ${className} ${isOpen ? 'open' : ''}`}
    >
      <Button
        basic
        type="button"
        className="chat-export-trigger"
        onClick={toggleDropdown}
        disabled={!canExport}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={intl.formatMessage(
          chatSessionId
            ? messagesI18n.exportOrShareConversation
            : messagesI18n.exportConversation,
        )}
        title={intl.formatMessage(
          chatSessionId
            ? messagesI18n.exportOrShareConversation
            : messagesI18n.exportConversation,
        )}
      >
        <SVGIcon name={DownloadIcon} size={15} className="export-icon" />
      </Button>

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
            onClick={handleExportHtml}
          >
            <span className="export-format-badge">HTML</span>
            <span className="export-format-name">Web Page (.html)</span>
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

          {chatSessionId && (
            <button
              type="button"
              className="chat-export-item chat-share-link-item"
              role="menuitem"
              onClick={handleCopyLink}
            >
              <span className="export-format-badge">
                <SVGIcon name={isCopied ? CheckIcon : CopyIcon} size={13} />
              </span>
              <span className="export-format-name">
                {isCopied ? (
                  <FormattedMessage
                    id="Link copied!"
                    defaultMessage="Link copied!"
                  />
                ) : (
                  <FormattedMessage
                    id="Shareable link"
                    defaultMessage="Shareable link"
                  />
                )}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatExportDropdown;
