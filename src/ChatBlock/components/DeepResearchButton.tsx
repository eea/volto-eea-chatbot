import React from 'react';
import { useIntl, defineMessages, FormattedMessage } from 'react-intl';
import SVGIcon from './Icon';
import HourglassIcon from '@eeacms/volto-eea-chatbot/icons/hourglass.svg';

const messages = defineMessages({
  deepResearch: {
    id: 'Deep research',
    defaultMessage: 'Deep research',
  },
  deepResearchOn: {
    id: 'Deep research on',
    defaultMessage: 'Deep research on',
  },
});

interface DeepResearchButtonProps {
  enabled: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  alwaysOn?: boolean;
}

const DeepResearchButton: React.FC<DeepResearchButtonProps> = ({
  enabled,
  onToggle,
  disabled = false,
  alwaysOn = false,
}) => {
  const intl = useIntl();
  const labelMessage = alwaysOn ? messages.deepResearchOn : messages.deepResearch;
  const labelText = intl.formatMessage(labelMessage);

  const isActive = enabled || alwaysOn;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!disabled && !alwaysOn && onToggle) {
      onToggle();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={labelText}
      title={labelText}
      disabled={disabled && !alwaysOn}
      onClick={handleClick}
      className={`deep-research-btn${isActive ? ' active' : ''}${
        alwaysOn ? ' always-on' : ''
      }`}
    >
      <span className="deep-research-icon">
        <SVGIcon name={HourglassIcon} size={15} />
      </span>
      <span className="deep-research-label">
        <FormattedMessage {...labelMessage} />
      </span>
    </button>
  );
};

export default DeepResearchButton;
