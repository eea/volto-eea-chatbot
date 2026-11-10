import type {
  CustomToolPacket,
  CustomToolStart,
  CustomToolDelta,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import type { MessageRenderer } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { useEffect } from 'react';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';

export const CustomToolRenderer: MessageRenderer<CustomToolPacket> = ({
  packets,
  onComplete,
  children,
}) => {
  const toolStart = packets.find(
    (packet) => packet.obj.type === PacketType.CUSTOM_TOOL_START,
  )?.obj as CustomToolStart | undefined;

  const toolDeltas = packets
    .filter((packet) => packet.obj.type === PacketType.CUSTOM_TOOL_DELTA)
    .map((packet) => packet.obj as CustomToolDelta);

  const isComplete = packets.some(
    (packet) => packet.obj.type === PacketType.SECTION_END,
  );

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const toolName = toolStart?.tool_name || 'Custom Tool';

  const content = (
    <div className="custom-tool-renderer">
      <div className="tool-header">
        <span className="tool-icon">🔧</span>
        <strong>{toolName}</strong>
      </div>
      <div className="tool-results">
        {toolDeltas.map((delta, i) => (
          <div key={i} className="tool-result-item">
            {delta.response_type && (
              <div className="response-type">{delta.response_type}</div>
            )}
            {delta.data && (
              <pre className="tool-data">
                {JSON.stringify(delta.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return children({
    icon: null,
    status: isComplete ? 'Tool complete' : 'Running tool...',
    content,
  });
};
