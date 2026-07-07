import React from 'react';
import { Checkbox } from 'semantic-ui-react';
import { FormattedMessage } from 'react-intl';

const DeepResearchToggle = ({ mode, enabled, onChange }) => {
  if (mode === 'unavailable' || !mode) return null;

  if (mode === 'always_on') {
    return (
      <div className="ais-deep-research ais-deep-research-right">
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
    <div className="ais-deep-research ais-deep-research-right">
      <Checkbox
        toggle
        checked={enabled}
        label={
          <FormattedMessage id="Deep research" defaultMessage="Deep research" />
        }
        onChange={(_, { checked }) => onChange(checked)}
      />
    </div>
  );
};

export default DeepResearchToggle;
