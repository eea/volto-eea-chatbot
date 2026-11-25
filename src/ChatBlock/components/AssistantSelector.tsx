import { useEffect, useRef, useState } from 'react';
import { useIntl, defineMessages } from 'react-intl';
import type { Persona } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import ChevronIcon from '@eeacms/volto-eea-chatbot/icons/chevron.svg';
import CheckIcon from '@eeacms/volto-eea-chatbot/icons/check.svg';

const messages = defineMessages({
  selectAssistant: {
    id: 'Assistant: {name}',
    defaultMessage: 'Assistant: {name}',
  },
});

interface AssistantSelectorProps {
  personas: Persona[];
  activeId: number | string;
  onSelect: (persona: Persona) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function AssistantSelector({
  personas,
  activeId,
  onSelect,
  disabled = false,
  loading = false,
}: AssistantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intl = useIntl();

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

  // A stream starting mid-menu closes it: never switch mid-answer.
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  // Fewer than two is not a choice; not stable while loading.
  if (loading || !personas || personas.length < 2) {
    return null;
  }

  const active =
    personas.find((persona) => String(persona.id) === String(activeId)) ||
    personas[0];

  return (
    <div
      ref={containerRef}
      className={`assistant-selector ${isOpen ? 'open' : ''}`}
    >
      <button
        type="button"
        className="assistant-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={intl.formatMessage(messages.selectAssistant, {
          name: active?.name || '',
        })}
        title={active?.name}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="assistant-trigger-label">{active?.name}</span>
        <span
          className={`assistant-trigger-chevron ${isOpen ? 'expanded' : ''}`}
          aria-hidden="true"
        >
          <SVGIcon name={ChevronIcon} size={14} />
        </span>
      </button>

      {isOpen && (
        <div className="assistant-selector-menu" role="menu">
          {personas.map((persona) => {
            const isActive = String(persona.id) === String(active?.id);
            return (
              <button
                key={persona.id}
                type="button"
                role="menuitem"
                aria-current={isActive ? 'true' : undefined}
                disabled={disabled}
                className={`assistant-selector-item ${
                  isActive ? 'active' : ''
                }`}
                onClick={() => {
                  setIsOpen(false);
                  if (!isActive) {
                    onSelect(persona);
                  }
                }}
              >
                <span className="assistant-item-name">{persona.name}</span>
                {isActive && (
                  <span className="assistant-item-check" aria-hidden="true">
                    <SVGIcon name={CheckIcon} size={15} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
