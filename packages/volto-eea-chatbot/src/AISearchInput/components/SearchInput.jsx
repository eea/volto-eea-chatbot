import React from 'react';
import { FormattedMessage } from 'react-intl';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import SendIcon from '@eeacms/volto-eea-chatbot/icons/send.svg';

const SearchInput = ({ placeholderText, onSubmit, value, onChange, error }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="ais-search-input-field">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        aria-label={
          <FormattedMessage
            id="Ask your question..."
            defaultMessage="Ask your question..."
          />
        }
        aria-invalid={!!error}
        aria-describedby={error ? 'ais-input-error' : undefined}
      />
      <button
        type="button"
        onClick={onSubmit}
        className="ais-submit-btn"
        aria-label={
          <FormattedMessage
            id="Submit question"
            defaultMessage="Submit question"
          />
        }
      >
        <SVGIcon name={SendIcon} size={24} />
      </button>
      {error && (
        <div id="ais-input-error" className="ais-input-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default SearchInput;
