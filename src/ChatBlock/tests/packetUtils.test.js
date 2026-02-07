import {
  getSynteticPacket,
  isToolPacket,
  isDisplayPacket,
  isFinalAnswerComplete,
} from '../services/packetUtils';
import { PacketType } from '../types/streamingModels';

describe('packetUtils', () => {
  describe('getSynteticPacket', () => {
    it('creates a synthetic packet with given index and type', () => {
      const packet = getSynteticPacket(1, PacketType.MESSAGE_START);
      expect(packet).toEqual({
        ind: 1,
        obj: { type: PacketType.MESSAGE_START },
      });
    });

    it('creates packets with different types', () => {
      const searchPacket = getSynteticPacket(2, PacketType.SEARCH_TOOL_START);
      expect(searchPacket.ind).toBe(2);
      expect(searchPacket.obj.type).toBe(PacketType.SEARCH_TOOL_START);
    });
  });

  describe('isToolPacket', () => {
    it('returns true for SEARCH_TOOL_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for SEARCH_TOOL_DELTA packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.SEARCH_TOOL_DELTA } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for CUSTOM_TOOL_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.CUSTOM_TOOL_START } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for CUSTOM_TOOL_DELTA packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.CUSTOM_TOOL_DELTA } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for REASONING_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.REASONING_START } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for REASONING_DELTA packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.REASONING_DELTA } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns true for FETCH_TOOL_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.FETCH_TOOL_START } };
      expect(isToolPacket(packet)).toBe(true);
    });

    it('returns false for MESSAGE_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.MESSAGE_START } };
      expect(isToolPacket(packet)).toBe(false);
    });

    it('returns false for MESSAGE_DELTA packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.MESSAGE_DELTA } };
      expect(isToolPacket(packet)).toBe(false);
    });

    it('returns false for STOP packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.STOP } };
      expect(isToolPacket(packet)).toBe(false);
    });
  });

  describe('isDisplayPacket', () => {
    it('returns true for MESSAGE_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.MESSAGE_START } };
      expect(isDisplayPacket(packet)).toBe(true);
    });

    it('returns true for IMAGE_GENERATION_TOOL_START packets', () => {
      const packet = {
        ind: 1,
        obj: { type: PacketType.IMAGE_GENERATION_TOOL_START },
      };
      expect(isDisplayPacket(packet)).toBe(true);
    });

    it('returns false for SEARCH_TOOL_START packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.SEARCH_TOOL_START } };
      expect(isDisplayPacket(packet)).toBe(false);
    });

    it('returns false for MESSAGE_DELTA packets', () => {
      const packet = { ind: 1, obj: { type: PacketType.MESSAGE_DELTA } };
      expect(isDisplayPacket(packet)).toBe(false);
    });
  });

  describe('isFinalAnswerComplete', () => {
    it('returns false when no packets', () => {
      expect(isFinalAnswerComplete([])).toBe(false);
    });

    it('returns false when no MESSAGE_START packet', () => {
      const packets = [
        { ind: 1, obj: { type: PacketType.MESSAGE_DELTA, content: 'Hello' } },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ];
      expect(isFinalAnswerComplete(packets)).toBe(false);
    });

    it('returns false when MESSAGE_START exists but no matching SECTION_END', () => {
      const packets = [
        {
          ind: 1,
          obj: { type: PacketType.MESSAGE_START, content: '', id: '1' },
        },
        { ind: 1, obj: { type: PacketType.MESSAGE_DELTA, content: 'Hello' } },
      ];
      expect(isFinalAnswerComplete(packets)).toBe(false);
    });

    it('returns true when MESSAGE_START and matching SECTION_END exist', () => {
      const packets = [
        {
          ind: 1,
          obj: { type: PacketType.MESSAGE_START, content: '', id: '1' },
        },
        { ind: 1, obj: { type: PacketType.MESSAGE_DELTA, content: 'Hello' } },
        { ind: 1, obj: { type: PacketType.SECTION_END } },
      ];
      expect(isFinalAnswerComplete(packets)).toBe(true);
    });

    it('returns true when IMAGE_GENERATION_TOOL_START and matching SECTION_END exist', () => {
      const packets = [
        { ind: 2, obj: { type: PacketType.IMAGE_GENERATION_TOOL_START } },
        { ind: 2, obj: { type: PacketType.SECTION_END } },
      ];
      expect(isFinalAnswerComplete(packets)).toBe(true);
    });

    it('returns false when SECTION_END has different index', () => {
      const packets = [
        {
          ind: 1,
          obj: { type: PacketType.MESSAGE_START, content: '', id: '1' },
        },
        { ind: 2, obj: { type: PacketType.SECTION_END } },
      ];
      expect(isFinalAnswerComplete(packets)).toBe(false);
    });
  });
});
