import React from 'react';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import SparkleIcon from '@eeacms/volto-eea-chatbot/icons/sparkle.svg';
import { SlateViewer } from '@plone/volto/components';

const IntroHeader = ({ showIcon, blockTitle, introText }) => {
  if (!showIcon && !blockTitle && !introText) return null;

  return (
    <div className="ais-intro-header">
      {showIcon && (
        <SVGIcon name={SparkleIcon} size={20} className="ais-icon" />
      )}
      <div className="ais-intro-content">
        {blockTitle && <span className="ais-block-title">{blockTitle}</span>}
        {introText && <SlateViewer value={introText} />}
      </div>
    </div>
  );
};

export default IntroHeader;
