import React from 'react';

const PromptChips = ({ prompts, onSelect }) => {
  if (!prompts || prompts.length === 0) return null;

  return (
    <div className="ais-prompt-chips">
      {prompts.map((prompt, index) => (
        <button
          key={index}
          type="button"
          className="ais-chip"
          onClick={() => onSelect(prompt.message || prompt.label)}
        >
          {prompt.label}
        </button>
      ))}
    </div>
  );
};

export default PromptChips;
