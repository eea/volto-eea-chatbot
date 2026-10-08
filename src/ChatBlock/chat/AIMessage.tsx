import type { ChatMessageProps } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { useState, useMemo, useEffect } from 'react';
import cx from 'classnames';

import loadable from '@loadable/component';
import {
  Tab,
  Sidebar,
  Button,
  Message as SemanticMessage,
} from 'semantic-ui-react';
import { serializeNodes } from '@plone/volto-slate/editor/render';
import {
  useChunkEvidence,
  useDeepCompareMemoize,
  useQualityMarkers,
  useScrollonStream,
} from '@eeacms/volto-eea-chatbot/ChatBlock/hooks';
import { CHUNK_EVIDENCE_WINDOW } from '@eeacms/volto-eea-chatbot/ChatBlock/services/chunkEvidence';
import {
  MultiToolRenderer,
  RendererComponent,
} from '@eeacms/volto-eea-chatbot/ChatBlock/packets';
import { addCitations } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/citations';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import BotIcon from '@eeacms/volto-eea-chatbot/icons/bot.svg';
import ClearIcon from '@eeacms/volto-eea-chatbot/icons/clear.svg';
import StopIcon from '@eeacms/volto-eea-chatbot/icons/stop.svg';
import { trackEvent } from '@eeacms/volto-matomo/utils';
import { FormattedMessage } from 'react-intl';

// Lazy load heavy components
const SourceDetails: any = loadable(
  () => import('@eeacms/volto-eea-chatbot/ChatBlock/components/Source'),
);
const UserActionsToolbar: any = loadable(
  () =>
    import('@eeacms/volto-eea-chatbot/ChatBlock/components/UserActionsToolbar'),
);
const RelatedQuestions: any = loadable(
  () =>
    import('@eeacms/volto-eea-chatbot/ChatBlock/components/RelatedQuestions'),
);
const HalloumiFeedback: any = loadable(
  () =>
    import('@eeacms/volto-eea-chatbot/ChatBlock/components/HalloumiFeedback'),
);

function visit(node: any, type: string, visitor: (node: any, idx?: number, parent?: any) => void, idx?: number, parent?: any) {
  if (node.type === type) {
    visitor(node, idx, parent);
  }
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any, cidx: number) => {
      visit(child, type, visitor, cidx, node);
    });
  }
}

function addQualityMarkersPlugin() {
  return function (tree: any) {
    visit(tree, 'element', function (node: any) {
      node.children?.forEach((child: any, cidx: any) => {
        if (child.type === 'raw' && child.value?.trim() === '<br>') {
          const newNode = {
            ...child,
            type: 'element',
            tagName: 'br',
            children: [],
            value: '',
          };
          node.children[cidx] = newNode;
        }
      });
    });
    visit(tree, 'text', function (node: any, idx: any, parent: any) {
      if (node.value?.trim()) {
        const newNode = {
          type: 'element',
          tagName: 'span',
          children: [node],
        };
        parent.children[idx] = newNode;
      }
    });
  };
}

/**
 * Build a structured source object for the fact-checker backend.
 *
 * The backend accepts {text, title, source_type} dicts so it can
 * include document titles in LLM prompts without polluting the raw
 * text (which would break span-offset matching).
 *
 * `kind` tells the fact-checker how much text it actually got:
 * `chunk` = real Onyx chunk text, `snippet` = a search blurb, which can
 * never prove a claim false.
 */
export function buildHalloumiSource(doc: any, text: string, kind = 'snippet') {
  const cleanedText = text.replace(/\u00A0/g, ' ');
  return {
    text: cleanedText,
    title: doc.semantic_identifier || null,
    source_type: doc.source_type || null,
    link: doc.link || null,
    kind,
  };
}

function mapToolDocumentsToText(message: any) {
  if (!message?.toolCall?.tool_result) {
    return {};
  }

  const toolResult = message.toolCall.tool_result;

  if (Array.isArray(toolResult)) {
    return toolResult.reduce((acc: Record<string, string>, doc: any) => {
      if (doc.document_id && doc.content) {
        acc[doc.document_id] = doc.content;
      }
      return acc;
    }, {});
  }

  return {};
}

export function getContextSources(
  message: any,
  sources: any,
  qualityCheckContext: any = 'citations',
) {
  const documentIdToText = mapToolDocumentsToText(message);

  return qualityCheckContext !== 'all'
    ? sources.map((doc: any) => {
        // Prefer content from tool packets (may have enriched text),
        // but fall back to doc.content from final_documents.
        // Without this fallback, sources sent to the fact-checker are
        // empty strings when tool packets don't carry full content.
        const text = documentIdToText[doc.document_id] || doc.content || '';
        const cleanedText = text.replace(/\u00A0/g, ' ');
        return {
          ...doc,
          id: doc.document_id,
          text,
          // Keep for ClaimSegments span highlighting (plain text)
          halloumiContext: cleanedText,
          // Structured source for the fact-checker backend
          halloumiSource: buildHalloumiSource(doc, text),
        };
      })
    : // `messageProcessor.getMessage()` emits `toolCall` (singular); older
      // Onyx v2 message shapes used `toolCalls`. Accept both — reading only the
      // plural made 'all' mode send zero sources, which the fact-checker then
      // reported as "Answer cannot be verified due to empty sources."
      [message.toolCall, ...(message.toolCalls || [])].reduce(
        (acc: any, cur: any) => [
          ...acc,
          ...((cur && cur.tool_result) || []).map((doc: any) => {
            const cleanedText = (doc.content || '').replace(/\u00A0/g, ' ');
            return {
              ...doc,
              id: doc.document_id,
              text: doc.content,
              halloumiContext: cleanedText,
              halloumiSource: buildHalloumiSource(doc, doc.content || ''),
            };
          }),
        ], // TODO: make sure we don't add multiple times the same doc
        // TODO: this doesn't have the index for source
        [],
      );
}

function getScoreDetails(rawClaims: any, qualityCheckStages: any) {
  const claims = rawClaims.filter((claim: any) => !claim.skipped);
  const score = (
    (claims.length > 0
      ? claims
          .filter((claim: any) => !claim.skipped)
          .reduce((acc: any, { score }: any) => acc + score, 0) / claims.length
      : 1) * 100
  ).toFixed(0);

  const scoreStage = qualityCheckStages?.find(
    ({ start, end }: any) => start <= score && score <= end,
  );
  const isFirstScoreStage =
    qualityCheckStages?.reduce(
      (acc: any, { start, end }: any, curIx: any) =>
        start <= score && score <= end ? curIx : acc,
      -1,
    ) ?? -1;
  const scoreColor = scoreStage?.color || 'black';
  return { score, scoreStage, isFirstScoreStage, scoreColor };
}

export function AIMessage({
  message,
  prevMessage,
  isLoading,
  libs,
  onChoice,
  onFetchRelatedQuestions,
  enableFeedback,
  scrollToInput,
  feedbackReasons,
  qualityCheck,
  qualityCheckStages,
  qualityCheckContext = 'citations',
  qualityCheckEnabled,
  noSupportDocumentsMessage,
  totalFailMessage,
  isFetchingRelatedQuestions = false,
  enableShowTotalFailMessage,
  enableMatomoTracking,
  persona,
  maxContextSegments,
  batchSize,
  chunkEvidenceWindow = CHUNK_EVIDENCE_WINDOW,
  isLastMessage,
  className = '',
  chatWindowEndRef,
  showTools,
  hideSourcesTab,
  extraRemarkPlugins,
  extraMarkdownComponents,
  extraRehypePlugins,
  stopButton,
  onCancel,
}: ChatMessageProps) {
  const [allToolsDisplayed, setAllToolsDisplayed] = useState(false);
  const [messageDisplayed, setMessageDisplayed] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showSourcesSidebar, setShowSourcesSidebar] = useState(false);
  // Halloumi
  const [forceHalloumi, setForceHallomi] = useState(qualityCheck === 'enabled');
  const [verificationTriggered, setVerificationTriggered] = useState(false);
  const [isMessageVerified, setIsMessageVerified] = useState(false);

  useScrollonStream({
    bottomRef: chatWindowEndRef,
    isStreaming: isLoading || !messageDisplayed || isFetchingRelatedQuestions,
    enabled: scrollToInput,
  });

  const {
    groupedPackets = [],
    toolPackets = [],
    displayPackets = [],
    citations = {},
    documents = [],
    relatedQuestions,
    isComplete = false,
    error,
  } = message;

  // Separate tool groups from display groups
  const toolGroups = useMemo(() => {
    return groupedPackets.filter((group) => toolPackets.includes(group.ind));
  }, [groupedPackets, toolPackets]);

  const displayGroups = useMemo(() => {
    return groupedPackets.filter((group) => displayPackets.includes(group.ind));
  }, [groupedPackets, displayPackets]);

  const onAllToolsDisplayed = useMemo(() => {
    return () => {
      setAllToolsDisplayed(true);
    };
  }, []);

  // Build sources from citations
  const inverseMap = useMemo(
    () =>
      Object.entries(citations).reduce(
        (acc, [k, v]) => {
          return { ...acc, [v]: k };
        },
        {} as Record<string, string>,
      ),
    [citations],
  );

  const sources = useMemo(
    () =>
      Object.values(citations).map((doc_id) => {
        const doc = documents?.find((doc: any) => doc.document_id === doc_id);
        return {
          ...(doc || {}),
          index: inverseMap[doc_id],
        };
      }),
    [citations, documents, inverseMap],
  );

  const showSources = messageDisplayed && sources.length > 0;

  // Whether to actually render the classic Sources UI (tab, sidebar, inline
  // list). `hideSourcesTab` lets a variation present the cited documents a
  // different way (e.g. inline catalogue cards) while keeping quality-check
  // logic intact.
  const showSourcesTab = showSources && !hideSourcesTab;

  const contextSources = useMemo(
    () => getContextSources(message, sources, qualityCheckContext),
    [message, sources, qualityCheckContext],
  );

  const qualityControlRequested =
    messageDisplayed &&
    qualityCheck &&
    qualityCheck !== 'disabled' &&
    forceHalloumi &&
    showSources &&
    message.messageId &&
    message.messageId > -1 &&
    (qualityCheck === 'enabled' ||
      qualityCheckEnabled ||
      verificationTriggered);

  // The Onyx stream only carries search blurbs (~600 chars per document), while
  // the answer was written from full chunk text. Resolve the real text for
  // exactly the documents we are about to send, otherwise the fact-checker
  // marks supported claims as unsupported. See services/chunkEvidence.ts.
  const { evidence, isFetchingEvidence, evidenceSettled } = useChunkEvidence(
    contextSources,
    { enabled: qualityControlRequested, window: chunkEvidenceWindow },
  );

  const enrichedSources = useMemo(
    () =>
      contextSources.map((src: any) => {
        const resolved = src.document_id ? evidence[src.document_id] : null;
        if (!resolved || !resolved.text) {
          return src;
        }
        // Same nbsp cleaning as the blurb path: the frontend joins these
        // strings to highlight segments, the backend indexes the same text, so
        // both sides must stay byte-identical.
        const cleanedText = resolved.text.replace(/\u00A0/g, ' ');
        return {
          ...src,
          text: resolved.text,
          halloumiContext: cleanedText,
          halloumiSource: {
            ...(src.halloumiSource || {}),
            text: cleanedText,
            kind: resolved.kind,
          },
          evidenceChunks: resolved.chunks,
        };
      }),
    [contextSources, evidence],
  );

  // Deduplicate sources by text content. The streaming backend often sends
  // the same document in multiple packets (MESSAGE_START, SEARCH_TOOL_DELTA,
  // etc.), resulting in 40+ copies of the same text. Dedup keeps the first
  // occurrence, preserving order. Critical: texts must remain identical
  // between frontend (span highlighting) and backend (evidence spans).
  const dedupedSources = useMemo(() => {
    const seen = new Set<string>();
    return enrichedSources.filter((src: any) => {
      const key = src.halloumiContext || src.halloumiSource?.text || '';
      if (key && !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });
  }, [enrichedSources]);

  const stableContextSources = useDeepCompareMemoize(dedupedSources);

  // Don't spend a fact-check call on blurbs while the real text is in flight.
  const doQualityControl = qualityControlRequested && evidenceSettled;

  const { markers, isLoadingHalloumi, retryHalloumi }: any = useQualityMarkers(
    doQualityControl,
    addCitations(message.message, message),
    stableContextSources,
    maxContextSegments,
    batchSize,
  );

  const claims = markers?.claims || [];
  const emptyClaims = markers?.empty || false;
  const { score, scoreStage, scoreColor, isFirstScoreStage } = getScoreDetails(
    claims,
    qualityCheckStages,
  );

  const isFetching = isLoadingHalloumi || isLoading || isFetchingEvidence;
  const halloumiMessage =
    isMessageVerified || doQualityControl ? scoreStage?.label : '';

  const showVerifyClaimsButton =
    messageDisplayed &&
    sources.length > 0 &&
    !isFetching &&
    !markers &&
    (qualityCheck === 'ondemand' ||
      (qualityCheck === 'ondemand_toggle' && !qualityCheckEnabled));

  const showTotalFailMessage =
    messageDisplayed &&
    sources.length === 0 &&
    !isFetching &&
    enableShowTotalFailMessage;

  useEffect(() => {
    if (isFetchingRelatedQuestions || typeof relatedQuestions !== 'undefined') {
      return;
    }
    if (isLastMessage && isComplete && onFetchRelatedQuestions) {
      console.log(`[AIMessage] Triggering RQ: messageDisplayed=${messageDisplayed}, isComplete=${isComplete}, hasContent=${!!message.message}`);
      if (messageDisplayed) {
        onFetchRelatedQuestions();
      }
    }
  }, [
    messageDisplayed,
    relatedQuestions,
    isComplete,
    onFetchRelatedQuestions,
    isFetchingRelatedQuestions,
    isLastMessage,
    message.message,
  ]);

  useEffect(() => {
    if (qualityCheck === 'ondemand_toggle' && qualityCheckEnabled) {
      setForceHallomi(true);
    } else if (qualityCheck !== 'enabled') {
      setForceHallomi(false);
    }
  }, [qualityCheck, qualityCheckEnabled]);

  useEffect(() => {
    if (markers?.claims?.length > 0) {
      setIsMessageVerified(true);
    }
  }, [markers]);

  // Answer tab content
  const answerTab = (
    <div className="answer-tab">
      {/* Show first 3 sources inline */}
      {showSourcesTab && (
        <div className="sources">
          {sources.slice(0, 3).map((source: any, i: number) => (
            <SourceDetails source={source} key={i} index={source.index} />
          ))}

          {sources.length > 3 && (
            <Button
              className="source show-all-sources-btn"
              onClick={() => setShowSourcesSidebar(true)}
            >
              <div className="source-header">
                <div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className="chat-citation"></span>
                  ))}
                </div>
                <div className="source-title">See all sources</div>
              </div>
            </Button>
          )}
        </div>
      )}

      {/* Main message content */}
      <div className="message-content">
        {/* Render tools if any */}
        {toolGroups.length > 0 && (
          <MultiToolRenderer
            toolGroups={toolGroups}
            showTools={showTools}
            onAllToolsDisplayed={onAllToolsDisplayed}
            message={message}
            libs={libs}
          />
        )}

        {/* Display error message if present */}
        {!!error && (
          <div className="message-error">
            <SemanticMessage color="red" className="error-message">
              <div className="error-title">Error</div>
              <div className="error-content">{error}</div>
            </SemanticMessage>
          </div>
        )}

        {/* Display normal content if no error or if we have content to display alongside the error */}
        {(allToolsDisplayed ||
          toolGroups.length === 0 ||
          message.isFinalMessageComing) &&
          !error &&
          displayGroups.map((group) => (
            <div key={group.ind} className="message-display-group">
              <RendererComponent
                packets={group.packets}
                onComplete={() => setMessageDisplayed(true)}
                animate={!messageDisplayed}
                stopPacketSeen={isComplete}
                message={message}
                libs={libs}
                markers={markers}
                stableContextSources={stableContextSources}
                addQualityMarkersPlugin={addQualityMarkersPlugin}
                extraRemarkPlugins={extraRemarkPlugins}
                extraMarkdownComponents={extraMarkdownComponents}
                extraRehypePlugins={extraRehypePlugins}
              >
                {({ content }) => (
                  <div className="message-text-wrapper">{content}</div>
                )}
              </RendererComponent>
            </div>
          ))}

        {stopButton === 'message_loader' &&
          Boolean(message.isFinalMessageComing) &&
          isLoading &&
          isLastMessage &&
          onCancel && (
            <div className="inline-message-stop">
              <Button
                className="inline-message-stop-btn"
                type="button"
                aria-label="Stop generating"
                onClick={() => {
                  if (enableMatomoTracking) {
                    trackEvent({
                      category: persona ? `Chatbot - ${persona}` : 'Chatbot',
                      action: 'Chatbot: Stop generating',
                      name: 'Message generation stopped',
                    });
                  }
                  onCancel();
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
      </div>

      {/* Total fail message */}
      {showTotalFailMessage && (
        <SemanticMessage color="red">
          {serializeNodes(totalFailMessage)}
        </SemanticMessage>
      )}

      {/* Halloumi/Quality feedback */}
      {qualityCheck !== 'disabled' && !error && (
        <HalloumiFeedback
          sources={sources}
          halloumiMessage={halloumiMessage}
          isLoadingHalloumi={isLoadingHalloumi}
          markers={markers}
          score={score}
          scoreColor={scoreColor}
          onManualVerify={() => {
            setForceHallomi(true);
            setVerificationTriggered(true);
          }}
          showVerifyClaimsButton={showVerifyClaimsButton}
          retryHalloumi={retryHalloumi}
          emptyClaims={emptyClaims}
        />
      )}

      {/* User actions toolbar (feedback, copy, etc) */}
      {!isLoading && (
        <UserActionsToolbar
          message={message}
          enableFeedback={enableFeedback}
          feedbackReasons={feedbackReasons}
          enableMatomoTracking={enableMatomoTracking}
          persona={persona}
        />
      )}

      {isFirstScoreStage === -1 && serializeNodes(noSupportDocumentsMessage)}

      {isFetchingRelatedQuestions && isLastMessage && !error && (
        <SemanticMessage color="blue">
          <div className="related-questions-loader">
            Finding related questions...
          </div>
        </SemanticMessage>
      )}

      {/* Related questions */}

      {!error && (
        <RelatedQuestions
          persona={persona}
          message={message}
          isLoading={isLoading}
          onChoice={onChoice}
          enableMatomoTracking={enableMatomoTracking}
        />
      )}
    </div>
  );

  // Tab panes - conditionally include Sources tab
  const panes = [
    {
      menuItem: { key: 'answer', content: 'Answer', className: 'answer-tab' },
      pane: <Tab.Pane key="answer">{answerTab}</Tab.Pane>,
    },
    ...(showSourcesTab && !error
      ? [
          {
            menuItem: {
              key: 'sources',
              content: (
                <span>
                  Sources{' '}
                  <span className="sources-count">({sources.length})</span>
                </span>
              ),
              className: 'sources-tab',
            },
            pane: (
              <Tab.Pane key="sources">
                <div className="sources-listing">
                  <div className="sources">
                    {sources.map((source: any, i: number) => (
                      <SourceDetails
                        source={source}
                        key={i}
                        index={source.index}
                      />
                    ))}
                  </div>
                </div>
              </Tab.Pane>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={`comment ${className}`}>
      <div className="circle assistant">
        <SVGIcon name={BotIcon} size={20} color="white" />
      </div>

      <div className="comment-content">
        {/* Main content with tabs */}
        <div className="comment-tabs">
          <Tab
            activeIndex={activeTab}
            onTabChange={(_, data: any) => setActiveTab(data.activeIndex)}
            menu={{
              secondary: true,
              pointing: true,
              fluid: true,
              className: cx({ 'without-sources': !showSourcesTab }),
            }}
            panes={panes}
            renderActiveOnly={false}
          />

          {/* Sources sidebar */}
          {showSourcesTab && !error && (
            <Sidebar
              visible={showSourcesSidebar}
              animation="overlay"
              icon="labeled"
              width="wide"
              direction="right"
              className="sources-sidebar"
              onHide={() => setShowSourcesSidebar(false)}
            >
              <div className="sources-sidebar-heading">
                <h4>Sources</h4>
                <Button basic onClick={() => setShowSourcesSidebar(false)}>
                  <SVGIcon name={ClearIcon} size={24} />
                </Button>
              </div>
              <div className="sources-listing">
                <div className="sources">
                  {sources.map((source: any, i: number) => (
                    <SourceDetails
                      source={source}
                      key={i}
                      index={source.index}
                    />
                  ))}
                </div>
              </div>
            </Sidebar>
          )}
        </div>
      </div>
    </div>
  );
}
