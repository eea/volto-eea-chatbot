import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { trackEvent } from '@eeacms/volto-matomo/utils';

import IntroHeader from './components/IntroHeader';
import SearchInput from './components/SearchInput';
import PromptChips from './components/PromptChips';
import DeepResearchToggle from './components/DeepResearchToggle';
import DisclaimerText from './components/DisclaimerText';

import './styles.less';

const AISearchInputView = ({ data }) => {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(
    data.deepResearch === 'always_on' || data.deepResearch === 'user_on',
  );

  const variant = data.stylingVariant || 'dark';

  const handleSubmit = (message) => {
    setError(null);
    const q = (message || query).trim();

    if (!q) return;

    if (!data.assistantEndpoint) {
      setError(
        <FormattedMessage
          id="Assistant page is not configured. Please contact the site administrator."
          defaultMessage="Assistant page is not configured. Please contact the site administrator."
        />,
      );
      return;
    }

    // Build target URL
    let targetUrl;
    try {
      targetUrl = new URL(data.assistantEndpoint, window.location.origin);
    } catch {
      setError(
        <FormattedMessage
          id="Invalid assistant page URL."
          defaultMessage="Invalid assistant page URL."
        />,
      );
      return;
    }

    targetUrl.searchParams.set('query', q);
    if (data.deepResearch !== 'unavailable') {
      targetUrl.searchParams.set(
        'deepResearch',
        deepResearchEnabled ? 'true' : 'false',
      );
    }

    const targetString = targetUrl.pathname + targetUrl.search;

    // Matomo tracking
    trackEvent({
      category: 'Chatbot',
      action: 'AI Search Input: Question submitted',
      name: q.substring(0, 100),
    });

    // Navigate: client-side for same-origin, full for external
    if (targetUrl.origin === window.location.origin) {
      history.push(targetString);
    } else {
      window.location.href = targetUrl.toString();
    }
  };

  const handleChipSelect = (message) => {
    handleSubmit(message);
  };

  return (
    <div className={`ais-search-input ais-${variant}`}>
      <IntroHeader
        showIcon={data.showIcon}
        blockTitle={data.blockTitle}
        introText={data.introText}
      />

      <SearchInput
        placeholderText={data.placeholderText || 'Ask your question...'}
        onSubmit={() => handleSubmit()}
        value={query}
        onChange={(value) => {
          setQuery(value);
          setError(null);
        }}
        error={error}
      />

      <DeepResearchToggle
        mode={data.deepResearch}
        enabled={deepResearchEnabled}
        onChange={setDeepResearchEnabled}
      />

      {data.examplePromptsEnabled && data.examplePrompts && (
        <PromptChips
          prompts={data.examplePrompts}
          onSelect={handleChipSelect}
        />
      )}

      <DisclaimerText disclaimerText={data.disclaimerText} />
    </div>
  );
};

export default AISearchInputView;
