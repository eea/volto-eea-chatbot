import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { useHistory } from 'react-router-dom';
import type { Persona } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { Button, Form } from 'semantic-ui-react';
import { injectLazyLibs } from '@plone/volto/helpers/Loadable';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import { FormattedMessage, useIntl } from 'react-intl';

import { ChatMessage } from '.';
import AutoResizeTextarea from '@eeacms/volto-eea-chatbot/ChatBlock/components/AutoResizeTextarea';
import QualityCheckToggle from '@eeacms/volto-eea-chatbot/ChatBlock/components/QualityCheckToggle';
import EmptyState from '@eeacms/volto-eea-chatbot/ChatBlock/components/EmptyState';
import { useChatController } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks';
import McpToolSelector from '@eeacms/volto-eea-chatbot/ChatBlock/components/McpToolSelector';
import DeepResearchButton from '@eeacms/volto-eea-chatbot/ChatBlock/components/DeepResearchButton';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import PenIcon from '@eeacms/volto-eea-chatbot/icons/square-pen.svg';
import StopIcon from '@eeacms/volto-eea-chatbot/icons/stop.svg';
import ExternalLinkIcon from '@eeacms/volto-eea-chatbot/icons/external-link.svg';
import {
  getSharedChatSession,
  deserializeChatSession,
} from '@eeacms/volto-eea-chatbot/ChatBlock/services/chatSessionService';

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
  stopButton?: 'disabled' | 'input' | 'floating' | 'message_loader';
  enableStopButton?: boolean;
  scrollToInput?: boolean;
  feedbackReasons?: string[];
  qualityCheck?: string;
  qualityCheckStages?: string[];
  qualityCheckContext?: string;
  noSupportDocumentsMessage?: string;
  totalFailMessage?: string;
  enableShowTotalFailMessage?: boolean;
  deepResearch?: string;
  showAssistantTitle?: boolean;
  showAssistantDescription?: boolean;
  starterPromptsPosition?: 'top' | 'bottom';
  enableMatomoTracking?: boolean;
  onDemandInputToggle?: boolean;
  maxContextSegments?: number;
  batchSize?: number;
  chunkEvidenceWindow?: number;
  onyxVersion?: '2' | '3';
  enableDownload?: boolean;
  enableExport?: boolean;
  enableShare?: boolean;
  enableToolSelection?: boolean;
  allowedTools?: (number | string)[];
  defaultEnabledTools?: (number | string)[];
  isPlaywrightTest?: boolean;
  initialQuery?: string | null;
  initialDeepResearch?: string | null;
  initialChatSessionId?: string | null;
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
  initialQuery,
  initialDeepResearch,
  initialChatSessionId,
  ...data
}: ChatWindowProps) {
  const {
    height,
    qgenAsistantId,
    enableQgen,
    enableFeedback = true,
    stopButton,
    enableStopButton = true,
    scrollToInput,
    feedbackReasons,
    qualityCheck = 'disabled',
    qualityCheckStages = [],
    qualityCheckContext = 'citations',
    noSupportDocumentsMessage,
    totalFailMessage,
    enableShowTotalFailMessage,
    deepResearch,
    showAssistantTitle,
    showAssistantDescription,
    starterPromptsPosition = 'top',
    enableMatomoTracking = true,
    onDemandInputToggle = true,
    maxContextSegments = 0,
    batchSize,
    chunkEvidenceWindow,
    onyxVersion = '3',
    enableToolSelection = true,
    allowedTools,
    defaultEnabledTools,
    hideSourcesTab,
    extraRemarkPlugins,
    extraMarkdownComponents,
    extraRehypePlugins,
  } = data;

  const isDownloadEnabled =
    typeof data.enableDownload !== 'undefined'
      ? Boolean(data.enableDownload)
      : typeof data.enableExport !== 'undefined'
        ? Boolean(data.enableExport)
        : true;

  const isShareEnabled =
    typeof data.enableShare !== 'undefined'
      ? Boolean(data.enableShare)
      : true;

  const stopButtonSetting:
    | 'disabled'
    | 'input'
    | 'floating'
    | 'message_loader' =
    stopButton || (enableStopButton === false ? 'disabled' : 'floating');

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
    loadChatSession,
    cancelStreaming,
    setIsDeepResearchEnabled,
    isDeepResearchEnabled,
    chatSessionId,
    selectedToolIds,
    toggleTool,
    enableTool,
    availableTools,
  } = useChatController({
    personaId: persona.id,
    persona,
    qgenAsistantId,
    enableQgen,
    deepResearch,
    onyxVersion,
    allowedToolIds: allowedTools,
    defaultEnabledToolIds: defaultEnabledTools,
  });

  const [showLandingPage, setShowLandingPage] = useState(true);
  const [isSharedView, setIsSharedView] = useState(false);
  const [sharedSessionLoading, setSharedSessionLoading] = useState(false);
  const [sharedSessionError, setSharedSessionError] = useState(false);

  const history = useHistory();
  const intl = useIntl();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatWindowRef = useRef(null);
  const chatWindowEndRef = useRef(null);
  const hasTrackedContinuationRef = useRef(false);

  // Load shared session from URL parameter on mount
  useEffect(() => {
    let isMounted = true;
    if (initialChatSessionId && messages.length === 0) {
      setSharedSessionLoading(true);
      setSharedSessionError(false);
      setShowLandingPage(false);

      getSharedChatSession(initialChatSessionId)
        .then((detail) => {
          if (!isMounted) return;
          const deserialized = deserializeChatSession(detail);
          loadChatSession(initialChatSessionId, deserialized);
          setIsSharedView(true);
          setSharedSessionLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          // eslint-disable-next-line no-console
          console.error('Failed to load shared conversation:', err);
          setSharedSessionError(true);
          setSharedSessionLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [initialChatSessionId, loadChatSession]);

  // Track when a shared session is continued into a new session
  useEffect(() => {
    if (
      isSharedView &&
      chatSessionId &&
      initialChatSessionId &&
      chatSessionId !== initialChatSessionId
    ) {
      setIsSharedView(false);
      if (
        typeof window !== 'undefined' &&
        (window.location?.search?.includes('chat=') ||
          window.location?.search?.includes('session='))
      ) {
        history.replace(window.location.pathname);
      }
    }
  }, [chatSessionId, isSharedView, initialChatSessionId, history]);

  const handleClearChat = useCallback(() => {
    hasTrackedContinuationRef.current = false;
    if (enableMatomoTracking) {
      trackEvent({
        category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
        action: 'Start new conversation',
        name: 'Top toolbar',
      });
    }
    clearChat();
    setIsSharedView(false);
    setSharedSessionError(false);
    setShowLandingPage(true);
    if (
      typeof window !== 'undefined' &&
      (window.location?.search?.includes('chat=') ||
        window.location?.search?.includes('session='))
    ) {
      history.replace(window.location.pathname);
    }
  }, [clearChat, history]);

  const handleFormSubmit = useCallback(
    ({ message }: { message: string }) => {
      if (
        isSharedView &&
        !hasTrackedContinuationRef.current &&
        enableMatomoTracking
      ) {
        hasTrackedContinuationRef.current = true;
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: 'Shared conversation continued',
          name: initialChatSessionId || 'Continuation',
        });
      }
      onSubmit({ message });
      setShowLandingPage(false);
    },
    [
      onSubmit,
      isSharedView,
      enableMatomoTracking,
      persona,
      initialChatSessionId,
    ],
  );

  useEffect(() => {
    setShowLandingPage(messages.length === 0);
  }, [messages]);

  // Set deep research state from URL parameter
  useEffect(() => {
    if (initialDeepResearch !== null && initialDeepResearch !== undefined) {
      const enabled = initialDeepResearch.toLowerCase() === 'true';
      setIsDeepResearchEnabled(enabled);
    }
  }, []);

  // Auto-submit query from URL parameter on mount
  useEffect(() => {
    if (initialQuery && messages.length === 0 && !isStreaming) {
      onSubmit({ message: initialQuery });
      setShowLandingPage(false);
      history.replace(window.location.pathname);
    }
  }, []);

  const handleStarterPromptChoice = useCallback(
    (message: string) => {
      if (enableMatomoTracking) {
        trackEvent({
          category: persona?.name ? `Chatbot - ${persona.name}` : 'Chatbot',
          action: 'Chatbot: Starter prompt click',
          name: 'Message submitted',
        });
      }
      handleFormSubmit({ message });
    },
    [persona, enableMatomoTracking, handleFormSubmit],
  );

  return (
    <div
      className="chat-window"
      data-playwright-block-id={isPlaywrightTest ? block_id : undefined}
    >
      <div className="messages">
        {sharedSessionLoading ? (
          <div className="shared-chat-loading" role="status" aria-live="polite">
            <div className="shared-chat-spinner" />
            <p>
              <FormattedMessage
                id="Loading shared conversation..."
                defaultMessage="Loading shared conversation..."
              />
            </p>
          </div>
        ) : sharedSessionError ? (
          <div className="shared-chat-error" role="alert">
            <p>
              <FormattedMessage
                id="This shared conversation could not be found or is private."
                defaultMessage="This shared conversation could not be found or is private."
              />
            </p>
            <Button onClick={handleClearChat} primary>
              <FormattedMessage
                id="Start a new conversation"
                defaultMessage="Start a new conversation"
              />
            </Button>
          </div>
        ) : showLandingPage ? (
          <>
            {showAssistantTitle && <h2>{persona.name}</h2>}
            {showAssistantDescription && <p>{persona.description}</p>}

            {starterPromptsPosition === 'top' && (
              <EmptyState
                {...data}
                block_id={block_id}
                persona={persona}
                onChoice={handleStarterPromptChoice}
              />
            )}
          </>
        ) : (
          <>
            <div className="chat-window-top-toolbar">
              <Button
                onClick={handleClearChat}
                disabled={isStreaming}
                className="start-new-chat-btn"
                aria-label={intl.formatMessage({
                  id: 'Start a new conversation',
                  defaultMessage: 'Start a new conversation',
                })}
              >
                <SVGIcon name={PenIcon} size={14} />{' '}
                <FormattedMessage
                  id="Start a new conversation"
                  defaultMessage="Start a new conversation"
                />
              </Button>
            </div>

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
                    chatSessionId={chatSessionId}
                    onNewChat={handleClearChat}
                    enableDownload={isDownloadEnabled}
                    enableShare={isShareEnabled}
                    allMessages={messages}
                    isDeepResearchEnabled={isDeepResearchEnabled}
                    libs={libs}
                    onChoice={
                      isSharedView
                        ? undefined
                        : (message) => handleFormSubmit({ message })
                    }
                    onFetchRelatedQuestions={
                      isSharedView ? undefined : onFetchRelatedQuestions
                    }
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
                    persona={persona}
                    maxContextSegments={maxContextSegments}
                    batchSize={batchSize}
                    chunkEvidenceWindow={chunkEvidenceWindow}
                    isLastMessage={index === messages.length - 1}
                    className={
                      index === messages.length - 1 ? 'most-recent' : ''
                    }
                    chatWindowRef={chatWindowRef}
                    chatWindowEndRef={chatWindowEndRef}
                    hideSourcesTab={hideSourcesTab}
                    extraRemarkPlugins={extraRemarkPlugins}
                    extraMarkdownComponents={extraMarkdownComponents}
                    extraRehypePlugins={extraRehypePlugins}
                    stopButton={stopButtonSetting}
                    onCancel={cancelStreaming}
                  />
                </React.Fragment>
              ))}

              {isStreaming &&
                !isFetchingRelatedQuestions &&
                messages[messages.length - 1]?.type === 'user' && (
                  <div className="comment">
                    <div className="circle assistant placeholder"></div>
                    <div className="comment-content">
                      <div className="loader-container">
                        <div className="loader" />
                        {stopButtonSetting === 'message_loader' && (
                          <div className="message-loader-stop">
                            <Button
                              className="message-loader-stop-btn"
                              type="button"
                              aria-label="Stop generating"
                              onClick={() => {
                                if (enableMatomoTracking) {
                                  trackEvent({
                                    category: persona?.name
                                      ? `Chatbot - ${persona.name}`
                                      : 'Chatbot',
                                    action: 'Chatbot: Stop generating',
                                    name: 'Message generation stopped',
                                  });
                                }
                                cancelStreaming();
                              }}
                            >
                              <div className="stop-btn-inner">
                                <div className="stop-icon-circle">
                                  <SVGIcon
                                    name={StopIcon}
                                    size={8}
                                    color="#fff"
                                  />
                                </div>
                                <span>
                                  <FormattedMessage
                                    id="Stop generating"
                                    defaultMessage="Stop generating"
                                  />
                                </span>
                              </div>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </div>

      <div className="chat-form">
        {stopButtonSetting === 'floating' && isStreaming && (
          <div className="chat-floating-stop">
            <Button
              className="floating-stop-btn"
              type="button"
              aria-label="Stop generating"
              onClick={() => {
                if (enableMatomoTracking) {
                  trackEvent({
                    category: persona?.name
                      ? `Chatbot - ${persona.name}`
                      : 'Chatbot',
                    action: 'Chatbot: Stop generating',
                    name: 'Message generation stopped',
                  });
                }
                cancelStreaming();
              }}
            >
              <div className="stop-btn-inner">
                <div className="stop-icon-circle">
                  <SVGIcon name={StopIcon} size={8} color="#fff" />
                </div>
                <span>
                  <FormattedMessage
                    id="Stop generating"
                    defaultMessage="Stop generating"
                  />
                </span>
              </div>
            </Button>
          </div>
        )}
        {/* @ts-ignore */}
        {sharedSessionLoading || sharedSessionError ? null : (
          <>
            {isSharedView && (
              <div className="shared-chat-notice">
                <span className="shared-chat-notice-text">
                  <SVGIcon name={ExternalLinkIcon} size={14} />{' '}
                  <FormattedMessage
                    id="You are viewing a shared conversation. Ask a follow-up to continue in your own chat."
                    defaultMessage="You are viewing a shared conversation. Ask a follow-up to continue in your own chat."
                  />
                </span>
              </div>
            )}
            <Form>
              <AutoResizeTextarea
                // @ts-ignore TODO: convert AutoResizeTextarea to TypeScript
                maxRows={8}
                minRows={1}
                ref={textareaRef}
                placeholder={
                  messages.length > 0 ? 'Ask follow-up...' : placeholderPrompt
                }
                isStreaming={isStreaming}
                stopButton={stopButtonSetting}
                onCancel={cancelStreaming}
                enableMatomoTracking={enableMatomoTracking}
                persona={persona}
                onSubmit={handleFormSubmit}
                availableTools={availableTools}
                selectedToolIds={selectedToolIds}
                onEnableTool={enableTool}
                toolbarLeft={
                  <>
                    {enableToolSelection && availableTools?.length > 0 && (
                      <McpToolSelector
                        availableTools={availableTools}
                        selectedToolIds={selectedToolIds}
                        onToggleTool={(toolId: number) => {
                          if (enableMatomoTracking) {
                            const tool = availableTools.find(
                              (t) => t.id === toolId,
                            );
                            const isCurrentlySelected =
                              selectedToolIds.includes(toolId);
                            if (tool) {
                              trackEvent({
                                category: persona?.name
                                  ? `Chatbot - ${persona.name}`
                                  : 'Chatbot',
                                action: isCurrentlySelected
                                  ? 'MCP tool disabled'
                                  : 'MCP tool enabled',
                                name: (
                                  tool.display_name ||
                                  tool.name ||
                                  ''
                                ).trim(),
                              });
                            }
                          }
                          toggleTool(toolId);
                        }}
                        disabled={isStreaming}
                      />
                    )}

                    {showDeepResearchToggle && (
                      <DeepResearchButton
                        enabled={isDeepResearchEnabled}
                        onToggle={() => {
                          setIsDeepResearchEnabled((prev) => !prev);
                          textareaRef.current?.focus();
                        }}
                        disabled={isStreaming}
                      />
                    )}

                    {deepResearch === 'always_on' && (
                      <DeepResearchButton
                        enabled={true}
                        disabled={true}
                        alwaysOn={true}
                      />
                    )}

                    {qualityCheck === 'ondemand_toggle' && (
                      <QualityCheckToggle
                        isEditMode={isEditMode}
                        enabled={qualityCheckEnabled}
                        setEnabled={setQualityCheckEnabled}
                      />
                    )}
                  </>
                }
              />
            </Form>
          </>
        )}
        <div ref={chatWindowEndRef} /> {/* End div to mark the bottom */}
      </div>

      {showLandingPage && starterPromptsPosition === 'bottom' && (
        <EmptyState
          {...data}
          block_id={block_id}
          persona={persona}
          onChoice={handleStarterPromptChoice}
        />
      )}
    </div>
  );
}

export default injectLazyLibs(['rehypePrism', 'remarkGfm'])(ChatWindow);
