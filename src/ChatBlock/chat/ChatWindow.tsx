import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import type { Persona } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { Button, Form, Segment, Checkbox } from 'semantic-ui-react';
import { injectLazyLibs } from '@plone/volto/helpers/Loadable';
import { trackEvent } from '@eeacms/volto-matomo/utils';

import { ChatMessage } from '.';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import AutoResizeTextarea from '@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea';
import QualityCheckToggle from '@eeacms/volto-eea-chatbot/ChatBlock/components/QualityCheckToggle';
import EmptyState from '@eeacms/volto-eea-chatbot/ChatBlock/components/EmptyState';
import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import PenIcon from '@eeacms/volto-eea-chatbot/icons/square-pen.svg';

import '@eeacms/volto-eea-chatbot/ChatBlock/style.less';

interface ChatWindowProps {
  block_id?: string;
  persona: Persona;
  rehypePrism?: any;
  remarkGfm?: any;
  placeholderPrompt?: string;
  isEditMode?: boolean;
  height?: string;
  qgenAsistantId?: number;
  enableQgen?: boolean;
  enableFeedback?: boolean;
  scrollToInput?: boolean;
  feedbackReasons?: string[];
  qualityCheck?: string;
  qualityCheckStages?: string[];
  qualityCheckContext?: string;
  noSupportDocumentsMessage?: string;
  totalFailMessage?: string;
  enableShowTotalFailMessage?: boolean;
  deepResearch?: string;
  showTools?: PacketType[];
  showAssistantTitle?: boolean;
  showAssistantDescription?: boolean;
  starterPromptsPosition?: 'top' | 'bottom';
  enableMatomoTracking?: boolean;
  onDemandInputToggle?: boolean;
  maxContextSegments?: number;
  onyxVersion?: '2' | '3';
  isPlaywrightTest?: boolean;
  [key: string]: any;
}

function ChatWindow({
  block_id,
  persona,
  rehypePrism,
  remarkGfm,
  placeholderPrompt = 'Ask a question',
  isEditMode,
  isPlaywrightTest,
  ...data
}: ChatWindowProps) {
  const {
    height,
    qgenAsistantId,
    enableQgen,
    enableFeedback = true,
    scrollToInput,
    feedbackReasons,
    qualityCheck = 'disabled',
    qualityCheckStages = [],
    qualityCheckContext = 'citations',
    noSupportDocumentsMessage,
    totalFailMessage,
    enableShowTotalFailMessage,
    deepResearch,
    showTools,
    showAssistantTitle,
    showAssistantDescription,
    starterPromptsPosition = 'top',
    enableMatomoTracking = true,
    onDemandInputToggle = true,
    maxContextSegments = 0,
    onyxVersion = '2',
  } = data;
  const [qualityCheckEnabled, setQualityCheckEnabled] = useState(
    onDemandInputToggle ?? true,
  );

  const showDeepResearchToggle =
    deepResearch === 'user_on' || deepResearch === 'user_off';

  useEffect(() => {
    if (isEditMode && qualityCheck === 'ondemand_toggle') {
      setQualityCheckEnabled(onDemandInputToggle ?? true);
    }
  }, [onDemandInputToggle, qualityCheck, isEditMode]);

  // Memoize libs object to prevent recreation on every render
  const libs = useMemo(
    () => ({ rehypePrism, remarkGfm }),
    [rehypePrism, remarkGfm],
  );

  const {
    onSubmit,
    onFetchRelatedQuestions,
    messages,
    isStreaming,
    isFetchingRelatedQuestions,
    clearChat,
    setIsDeepResearchEnabled,
    isDeepResearchEnabled,
  } = useChatController({
    personaId: persona.id,
    qgenAsistantId,
    enableQgen,
    deepResearch,
    onyxVersion,
  });

  const [showLandingPage, setShowLandingPage] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatWindowRef = useRef(null);
  const chatWindowEndRef = useRef(null);

  useEffect(() => {
    setShowLandingPage(messages.length === 0);
  }, [messages]);

  const handleStarterPromptChoice = useCallback(
    (message: string) => {
      if (enableMatomoTracking) {
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: 'Chatbot: Starter prompt click',
          name: 'Message submitted',
        });
      }
      onSubmit({ message });
      setShowLandingPage(false);
    },
    [persona, enableMatomoTracking, onSubmit],
  );

  return (
    <div
      className="chat-window"
      data-playwright-block-id={isPlaywrightTest ? block_id : undefined}
    >
      <div className="messages">
        {showLandingPage ? (
          <>
            {showAssistantTitle && <h2>{persona.name}</h2>}
            {showAssistantDescription && <p>{persona.description}</p>}

            {starterPromptsPosition === 'top' && (
              <EmptyState
                {...data}
                persona={persona}
                onChoice={handleStarterPromptChoice}
              />
            )}
          </>
        ) : (
          <>
            {/* @ts-ignore */}
            <Segment clearing basic>
              <Button
                disabled={isStreaming}
                onClick={clearChat}
                className="right floated clear-chat"
                aria-label="Clear chat"
              >
                <SVGIcon name={PenIcon} /> New chat
              </Button>
            </Segment>
            <div
              ref={chatWindowRef}
              className={`conversation ${height ? 'include-scrollbar' : ''}`}
              style={{ maxHeight: height }}
            >
              {messages.map((message, index) => (
                <React.Fragment key={message.messageId}>
                  <ChatMessage
                    prevMessage={messages[index - 1]}
                    message={message}
                    isLoading={isStreaming}
                    isDeepResearchEnabled={isDeepResearchEnabled}
                    libs={libs}
                    onChoice={(message) => onSubmit({ message })}
                    onFetchRelatedQuestions={onFetchRelatedQuestions}
                    enableFeedback={enableFeedback}
                    scrollToInput={scrollToInput}
                    feedbackReasons={feedbackReasons}
                    qualityCheck={qualityCheck}
                    qualityCheckStages={qualityCheckStages}
                    qualityCheckContext={qualityCheckContext}
                    qualityCheckEnabled={qualityCheckEnabled}
                    noSupportDocumentsMessage={noSupportDocumentsMessage}
                    totalFailMessage={totalFailMessage}
                    isFetchingRelatedQuestions={isFetchingRelatedQuestions}
                    enableShowTotalFailMessage={enableShowTotalFailMessage}
                    enableMatomoTracking={enableMatomoTracking}
                    persona={persona.id}
                    maxContextSegments={maxContextSegments}
                    isLastMessage={index === messages.length - 1}
                    className={
                      index === messages.length - 1 ? 'most-recent' : ''
                    }
                    chatWindowRef={chatWindowRef}
                    chatWindowEndRef={chatWindowEndRef}
                    showTools={showTools}
                  />
                </React.Fragment>
              ))}

              {isStreaming &&
                !isFetchingRelatedQuestions &&
                !messages[messages.length - 1]?.isFinalMessageComing && (
                  <div className="comment">
                    <div className="circle assistant placeholder"></div>
                    <div className="comment-content">
                      <div className="loader-container">
                        <div className="loader" />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </div>

      <div className="chat-form">
        {/* @ts-ignore */}
        <Form>
          <div className="textarea-wrapper">
            <AutoResizeTextarea
              // @ts-ignore TODO: convert AutoResizeTextarea to TypeScript
              maxRows={8}
              minRows={1}
              ref={textareaRef}
              placeholder={
                messages.length > 0 ? 'Ask follow-up...' : placeholderPrompt
              }
              isStreaming={isStreaming}
              enableMatomoTracking={enableMatomoTracking}
              persona={persona}
              onSubmit={onSubmit}
            />
          </div>
        </Form>
        <div className="chat-controls">
          {qualityCheck === 'ondemand_toggle' && (
            <QualityCheckToggle
              isEditMode={isEditMode}
              enabled={qualityCheckEnabled}
              setEnabled={setQualityCheckEnabled}
            />
          )}

          {showDeepResearchToggle && (
            <div className="deep-research-toggle">
              <Checkbox
                id="deep-research-toggle"
                toggle
                checked={isDeepResearchEnabled}
                label="Deep research"
                onChange={(_, { checked }) => {
                  setIsDeepResearchEnabled(checked ?? false);
                  textareaRef.current?.focus();
                }}
              />
            </div>
          )}

          {deepResearch === 'always_on' && (
            <small className="deep-research-toggle">Deep research on</small>
          )}
        </div>
        <div ref={chatWindowEndRef} /> {/* End div to mark the bottom */}
      </div>

      {showLandingPage && starterPromptsPosition === 'bottom' && (
        <EmptyState
          {...data}
          persona={persona}
          onChoice={handleStarterPromptChoice}
        />
      )}
    </div>
  );
}

export default injectLazyLibs(['rehypePrism', 'remarkGfm'])(ChatWindow);
