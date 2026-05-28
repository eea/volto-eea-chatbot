import type { Packet } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import type { Message } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import React, { useState, useEffect, useMemo } from 'react';
import cx from 'classnames';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import { RendererComponent } from './RendererComponent';
import { useToolDisplayTiming } from '@eeacms/volto-eea-chatbot/ChatBlock/hooks/useToolDisplayTiming';
import SVGIcon from '@eeacms/volto-eea-chatbot/ChatBlock/components/Icon';
import DoneIcon from '@eeacms/volto-eea-chatbot/icons/done.svg';
import ChevronIcon from '@eeacms/volto-eea-chatbot/icons/chevron.svg';

interface MultiToolRendererProps {
  toolGroups: { ind: number; packets: Packet[] }[];
  showTools?: PacketType[];
  message: Message;
  libs: any;
  onAllToolsDisplayed?: () => void;
}

export function MultiToolRenderer({
  toolGroups,
  showTools = [PacketType.SEARCH_TOOL_START, PacketType.REASONING_START],
  message,
  libs,
  onAllToolsDisplayed,
}: MultiToolRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isFinalMessageComing = false, isComplete = false } = message;

  // Filter tool groups based on allowed tool types
  const filteredToolGroups = useMemo(() => {
    const expandedShowTools = [...(showTools || [])];
    if (showTools?.includes(PacketType.SEARCH_TOOL_START)) {
      expandedShowTools.push(
        PacketType.SEARCH_TOOL_START_V3,
        PacketType.SEARCH_TOOL_QUERIES_DELTA,
        PacketType.SEARCH_TOOL_DOCUMENTS_DELTA,
        PacketType.SEARCH_TOOL_DELTA,
      );
    }
    if (showTools?.includes(PacketType.REASONING_START)) {
      expandedShowTools.push(
        PacketType.REASONING_DELTA,
        PacketType.REASONING_DONE,
        PacketType.REASONING_END as any,
      );
    }
    return toolGroups.filter((group) =>
      group.packets?.some((packet) =>
        expandedShowTools.includes(packet.obj.type as PacketType),
      ),
    );
  }, [toolGroups, showTools]);

  // Manage tool display timing
  const { allToolsDisplayed, handleToolComplete, toolStates } =
    useToolDisplayTiming(filteredToolGroups, isFinalMessageComing, isComplete);

  // Notify parent when all tools are displayed
  useEffect(() => {
    if (allToolsDisplayed && onAllToolsDisplayed) {
      onAllToolsDisplayed();
      setIsExpanded(false);
    }
  }, [allToolsDisplayed, onAllToolsDisplayed]);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  };

  if (filteredToolGroups.length === 0) return null;

  const isOverallStreaming = !allToolsDisplayed;

  const count = filteredToolGroups.length;

  const ariaLabel = `${count} ${
    isOverallStreaming ? 'processing' : 'completed'
  } ${count === 1 ? 'step' : 'steps'}, ${isExpanded ? 'expanded' : 'collapsed'}`;

  return (
    <div
      className={cx('multi-tool-renderer', {
        streaming: isOverallStreaming,
        complete: !isOverallStreaming,
      })}
    >
      {/* Header */}
      <div
        className={cx({ 'tools-container collapsed-view': isOverallStreaming })}
      >
        <div
          className={cx({
            'tools-collapsed-header': isOverallStreaming,
            'tools-summary-header': !isOverallStreaming,
          })}
          onClick={toggleExpanded}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={ariaLabel}
          onKeyDown={handleKeyDown}
        >
          <div className="tools-count">
            <span className="tools-count-value">
              {filteredToolGroups.length}
            </span>
            <span className="tools-count-label">
              {filteredToolGroups.length === 1 ? 'step' : 'steps'}
            </span>
          </div>
          <span className={cx('expand-chevron', { expanded: isExpanded })}>
            <SVGIcon name={ChevronIcon} size={24} />
          </span>
        </div>

        {/* Tools List */}
        <div
          className={cx({
            'tools-collapsed-list': isOverallStreaming,
            'tools-expanded-content': !isOverallStreaming,
            expanded: isExpanded && isOverallStreaming,
            visible: isExpanded && !isOverallStreaming,
          })}
        >
          <div className={cx({ 'tools-list': isOverallStreaming })}>
            <div>
              {filteredToolGroups.map((toolGroup, index) => {
                const isLastItem = index === filteredToolGroups.length - 1;
                const toolState = toolStates.get(toolGroup.ind);
                const isToolCompleted = toolState?.isCompleted;

                return (
                  <div
                    key={toolGroup.ind}
                    className={cx({
                      'tool-collapsed-wrapper': isOverallStreaming,
                    })}
                  >
                    <RendererComponent
                      packets={toolGroup.packets}
                      message={message}
                      libs={libs}
                      onComplete={() => {
                        if (toolGroup.ind !== undefined) {
                          handleToolComplete(toolGroup.ind);
                        }
                      }}
                      stopPacketSeen={isComplete}
                      animate={false}
                    >
                      {({ icon, content, status, expandedText }) => {
                        const finalIcon = icon ? (
                          React.createElement(icon, { size: 14 })
                        ) : (
                          <span
                            className={cx({
                              'tool-icon-dot': isOverallStreaming,
                              'tool-icon-default': !isOverallStreaming,
                            })}
                          />
                        );

                        // If tool is not completed and we are overall streaming, show collapsed view
                        // EXCEPT for reasoning and search which we want to see while they stream/progress
                        if (isOverallStreaming && !isToolCompleted) {
                          const isDetailedTool = toolGroup.packets.some(
                            (p) =>
                              p.obj.type === PacketType.REASONING_START ||
                              p.obj.type === PacketType.REASONING_DELTA ||
                              p.obj.type === PacketType.SEARCH_TOOL_START ||
                              p.obj.type === PacketType.SEARCH_TOOL_START_V3 ||
                              p.obj.type === PacketType.SEARCH_TOOL_DELTA ||
                              p.obj.type === PacketType.SEARCH_TOOL_QUERIES_DELTA ||
                              p.obj.type === PacketType.SEARCH_TOOL_DOCUMENTS_DELTA,
                          );

                          if (!isDetailedTool || !content) {
                            return (
                              <div
                                className={cx('tool-item-collapsed', {
                                  active: isLastItem,
                                  completed: isToolCompleted,
                                })}
                              >
                                <div className="tool-collapsed-icon">
                                  {finalIcon}
                                </div>
                                <span className="tool-collapsed-status">
                                  {status}
                                </span>
                              </div>
                            );
                          }
                        }

                        // Expanded view (full content) - used for completed tools or when overall complete
                        return (
                          <div className="tool-item-expanded">
                            <div className="tool-connector-line" />

                            <div className="tool-item-row">
                              <div className="tool-icon-wrapper">
                                <div className="tool-icon-circle">
                                  {finalIcon}
                                </div>
                              </div>

                              <div
                                className={cx('tool-content', {
                                  'with-padding': !isLastItem,
                                })}
                              >
                                {status && !expandedText && (
                                  <div className="tool-status-row">
                                    <div className="tool-status">{status}</div>
                                  </div>
                                )}

                                <div
                                  className={cx('tool-text', {
                                    expanded: expandedText,
                                  })}
                                >
                                  {expandedText || content}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </RendererComponent>
                  </div>
                );
              })}

              {/* Done node - only in complete state */}
              {allToolsDisplayed && (
                <div className="tool-done-node">
                  <div className="tool-done-row">
                    <div className="tool-icon-wrapper">
                      <div className="tool-icon-circle">
                        <span className="check-icon">
                          <SVGIcon name={DoneIcon} size={14} />
                        </span>
                      </div>
                    </div>
                    <div className="tool-done-content">
                      <div className="tool-done-text">Done</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
