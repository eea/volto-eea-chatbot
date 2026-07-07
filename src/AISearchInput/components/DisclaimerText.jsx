import React from 'react';
import { SlateViewer } from '@plone/volto/components';

const DisclaimerText = ({ disclaimerText }) => {
  if (!disclaimerText) return null;

  return (
    <div className="ais-disclaimer">
      <SlateViewer value={disclaimerText} />
    </div>
  );
};

export default DisclaimerText;
