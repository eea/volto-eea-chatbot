import React from 'react';
import { serializeNodes } from '@plone/volto-slate/editor/render';

const DisclaimerText = ({ disclaimerText }) => {
  if (!disclaimerText) return null;

  return <div className="ais-disclaimer">{serializeNodes(disclaimerText)}</div>;
};

export default DisclaimerText;
