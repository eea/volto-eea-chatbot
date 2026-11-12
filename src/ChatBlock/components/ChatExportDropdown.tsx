import { useState, useRef, useEffect, useCallback } from 'react';
import { FormattedMessage, useIntl, defineMessages } from 'react-intl';
import { Button } from 'semantic-ui-react';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import DownloadIcon from '@eeacms/volto-eea-chatbot/icons/download.svg';
import {
  exportConversationAsMarkdown,
  exportConversationAsPdf,
  exportConversationAsDocx,
  exportConversationAsHtml,
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
  enableMatomoTracking?: boolean;
}

const messagesI18n = defineMessages({
  exportConversation: {
    id: 'Export conversation',
    defaultMessage: 'Export conversation',
  },
});

export function ChatExportDropdown({
  messages,
  persona,
  disabled = false,
  className = '',
  hideWhenEmpty = true,
  enableMatomoTracking = true,
}: ChatExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intl = useIntl();

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
    closeDropdown();
    exportConversationAsMarkdown(messages, persona);
    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'Conversation exported',
        name: 'Markdown',
      });
    }
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const docxLib = await import('docx');
      await exportConversationAsDocx(messages, persona, docxLib);
      if (enableMatomoTracking) {
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: 'Conversation exported',
          name: 'DOCX',
        });
      }
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
    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'Conversation exported',
        name: 'PDF',
      });
    }
  };

  const handleExportHtml = () => {
    closeDropdown();
    exportConversationAsHtml(messages, persona);
    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'Conversation exported',
        name: 'HTML',
      });
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
        aria-label={intl.formatMessage(messagesI18n.exportConversation)}
        title={intl.formatMessage(messagesI18n.exportConversation)}
      >
        <SVGIcon name={DownloadIcon} size={15} className="export-icon" />
      </Button>

      {isOpen && (
        <div className="chat-export-menu" role="menu">
          <button
            type="button"
            className="chat-export-item format-md"
            role="menuitem"
            onClick={handleExportMarkdown}
          >
            <span className="export-format-badge">MD</span>
            <span className="export-format-name">Markdown (.md)</span>
          </button>

          <button
            type="button"
            className="chat-export-item format-docx"
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
            className="chat-export-item format-html"
            role="menuitem"
            onClick={handleExportHtml}
          >
            <span className="export-format-badge">HTML</span>
            <span className="export-format-name">Web Page (.html)</span>
          </button>

          <button
            type="button"
            className="chat-export-item format-pdf"
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
