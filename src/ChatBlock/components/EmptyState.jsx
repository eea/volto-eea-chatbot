import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from 'semantic-ui-react';
import { debounce } from '@eeacms/volto-eea-chatbot/ChatBlock/utils';
import {
  DEFAULT_SEED_QUESTIONS_COUNT,
  DEFAULT_SEED_QUESTIONS_CACHE_MINUTES,
  normalizeTopics,
  loadCachedSeedQuestions,
  saveCachedSeedQuestions,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/seedQuestions';

function StarterMessage({ msg, onClick }) {
  if (!(msg.name || msg.message)) return null;

  return (
    <Button onClick={onClick} onKeyDown={onClick} className="starter-message">
      <span className="starter-message-title">{msg.name}</span>
      {msg.description && (
        <div className="starter-message-desc">{msg.description}</div>
      )}
    </Button>
  );
}

export const click_signal = { current: null };

export default function EmptyState(props) {
  const {
    persona,
    onChoice,
    showAssistantPrompts = true,
    enableStarterPrompts,
    starterPrompts = [],
    starterPromptsHeading,
    enableGeneratedSeedQuestions = false,
    qgenAsistantId,
    seedQuestionsTopics,
    seedQuestionsCount = DEFAULT_SEED_QUESTIONS_COUNT,
    seedQuestionsCacheMinutes = DEFAULT_SEED_QUESTIONS_CACHE_MINUTES,
  } = props;

  const blockId = props.block || props.block_id || persona?.id || '';

  const topicsList = useMemo(
    () => normalizeTopics(seedQuestionsTopics),
    [seedQuestionsTopics],
  );

  const cacheKey = useMemo(
    () => `eea_seed_questions_${qgenAsistantId || 'default'}_${blockId}`,
    [qgenAsistantId, blockId],
  );

  const [generatedQuestions, setGeneratedQuestions] = useState(() => {
    if (!enableGeneratedSeedQuestions) return null;
    return loadCachedSeedQuestions(cacheKey, seedQuestionsCacheMinutes);
  });

  const [isLoadingSeedQuestions, setIsLoadingSeedQuestions] = useState(() => {
    if (!enableGeneratedSeedQuestions) return false;
    const cached = loadCachedSeedQuestions(cacheKey, seedQuestionsCacheMinutes);
    return !cached;
  });

  const fetchedKeyRef = useRef(null);

  // Keep a ref to latest params to prevent re-fetching on keystrokes in edit mode
  const latestParamsRef = useRef({
    topicsList,
    seedQuestionsCount,
    seedQuestionsCacheMinutes,
    persona,
  });
  latestParamsRef.current = {
    topicsList,
    seedQuestionsCount,
    seedQuestionsCacheMinutes,
    persona,
  };

  useEffect(() => {
    let isMounted = true;
    if (!enableGeneratedSeedQuestions) return;

    const currentCacheMinutes =
      latestParamsRef.current.seedQuestionsCacheMinutes;
    const cached = loadCachedSeedQuestions(cacheKey, currentCacheMinutes);
    if (cached && cached.length > 0) {
      fetchedKeyRef.current = cacheKey;
      setGeneratedQuestions(cached);
      setIsLoadingSeedQuestions(false);
      return;
    }

    if (
      fetchedKeyRef.current === cacheKey &&
      generatedQuestions &&
      generatedQuestions.length > 0
    ) {
      return;
    }

    setIsLoadingSeedQuestions(true);
    const {
      topicsList: currentTopics,
      seedQuestionsCount: currentCount,
      persona: currentPersona,
    } = latestParamsRef.current;

    const payload = {
      assistantId: qgenAsistantId,
      topics: currentTopics,
      count: currentCount,
      persona:
        currentPersona?.name || currentPersona?.description
          ? {
              name: currentPersona.name,
              description: currentPersona.description,
            }
          : undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    fetch('/_rq/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { questions: [] }))
      .then((data) => {
        clearTimeout(timeoutId);
        if (isMounted) {
          if (Array.isArray(data?.questions) && data.questions.length > 0) {
            fetchedKeyRef.current = cacheKey;
            setGeneratedQuestions(data.questions);
            saveCachedSeedQuestions(cacheKey, data.questions);
          } else {
            setGeneratedQuestions([]);
          }
          setIsLoadingSeedQuestions(false);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (isMounted) {
          setGeneratedQuestions([]);
          setIsLoadingSeedQuestions(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableGeneratedSeedQuestions, qgenAsistantId, cacheKey]);

  const prompts = useMemo(() => {
    if (enableGeneratedSeedQuestions && generatedQuestions?.length > 0) {
      return generatedQuestions.map((q) => ({ name: q, message: q }));
    }
    if (
      enableStarterPrompts &&
      (!enableGeneratedSeedQuestions || starterPrompts?.length > 0)
    ) {
      return starterPrompts;
    }
    if (enableGeneratedSeedQuestions || showAssistantPrompts) {
      return persona?.starter_messages || [];
    }
    return [];
  }, [
    enableGeneratedSeedQuestions,
    generatedQuestions,
    enableStarterPrompts,
    starterPrompts,
    showAssistantPrompts,
    persona?.starter_messages,
  ]);

  const showSkeletons = enableGeneratedSeedQuestions && isLoadingSeedQuestions;
  const skeletonCount =
    typeof props.seedQuestionsCount === 'number'
      ? props.seedQuestionsCount
      : persona?.starter_messages?.length || DEFAULT_SEED_QUESTIONS_COUNT;

  const shouldShowHeading =
    starterPromptsHeading && (showSkeletons || prompts.length > 0);

  return (
    <div className="empty-state">
      {shouldShowHeading && (
        <h4 className="starter-message-heading">{starterPromptsHeading}</h4>
      )}

      <div className="starter-messages-container">
        {showSkeletons
          ? Array.from({ length: skeletonCount }).map((_, idx) => (
              <div
                key={`seed-skeleton-${idx}`}
                className="starter-message starter-message-skeleton"
                aria-hidden="true"
              >
                <span className="starter-message-skeleton-line" />
              </div>
            ))
          : prompts.map((msg, idx) => (
              <StarterMessage
                key={msg.name || `starter-${idx}`}
                msg={msg}
                onClick={() =>
                  debounce(
                    () =>
                      onChoice(
                        msg.message || `${msg.name}\n${msg.description}`,
                      ),
                    click_signal,
                  )
                }
              />
            ))}
      </div>
    </div>
  );
}
