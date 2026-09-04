import type { Packet } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';
import { PacketType } from '@eeacms/volto-eea-chatbot/ChatBlock/types/streamingModels';

export function getSynteticPacket(ind: number, type: PacketType): Packet {
  return {
    ind,
    obj: { type } as any,
  };
}

export function isToolPacket(packet: Packet): boolean {
  const toolPacketTypes = [
    PacketType.SEARCH_TOOL_START,
    PacketType.SEARCH_TOOL_START_V3,
    PacketType.SEARCH_TOOL_QUERIES_DELTA,
    PacketType.SEARCH_TOOL_DOCUMENTS_DELTA,
    PacketType.SEARCH_TOOL_DELTA,
    PacketType.CUSTOM_TOOL_START,
    PacketType.CUSTOM_TOOL_DELTA,
    PacketType.REASONING_START,
    PacketType.REASONING_DELTA,
    PacketType.REASONING_DONE,
    PacketType.FETCH_TOOL_START,
  ];

  return toolPacketTypes.includes(packet.obj.type as PacketType);
}

export function isDisplayPacket(packet: Packet): boolean {
  return [
    PacketType.MESSAGE_START,
    PacketType.IMAGE_GENERATION_TOOL_START,
  ].includes(packet.obj.type as PacketType);
}

export function isFinalAnswerComplete(packets: Packet[]): boolean {
  const messageStartPacket = packets.find(
    (packet) =>
      packet.obj.type === PacketType.MESSAGE_START ||
      packet.obj.type === PacketType.IMAGE_GENERATION_TOOL_START,
  );

  if (!messageStartPacket) {
    return false;
  }

  const hasSectionEnd = packets.some(
    (packet) =>
      packet.obj.type === PacketType.SECTION_END &&
      packet.ind === messageStartPacket.ind,
  );

  if (hasSectionEnd) {
    console.log(`[isFinalAnswerComplete] Complete! ind=${messageStartPacket.ind}`);
  }

  return hasSectionEnd;
}
