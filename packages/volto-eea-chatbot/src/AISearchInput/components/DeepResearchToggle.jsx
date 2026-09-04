import React from 'react';
import { FormattedMessage } from 'react-intl';

const DeepResearchToggle = ({ mode, enabled, onChange }) => {
  if (mode === 'unavailable' || !mode) return null;

  if (mode === 'always_on') {
    return (
      <div className="ais-deep-research">
        <small className="ais-deep-research-label">
          <FormattedMessage
            id="Deep research on"
            defaultMessage="Deep research on"
          />
        </small>
      </div>
    );
  }

  return (
    <div className="ais-deep-research">
      <label className="ais-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ais-toggle-slider" />
        <FormattedMessage id="Deep research" defaultMessage="Deep research" />
      </label>
    </div>
  );
};

export default DeepResearchToggle;
