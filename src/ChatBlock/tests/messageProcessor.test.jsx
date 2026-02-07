import { MessageProcessor } from '../services/messageProcessor';
import { PacketType } from '../types/streamingModels';

describe('MessageProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new MessageProcessor(1, null);
  });

  it('should initialize with empty state', () => {
    const result = processor.getMessage();
    expect(result.groupedPackets).toEqual([]);
    expect(result.toolPackets).toEqual([]);
    expect(result.displayPackets).toEqual([]);
    expect(result.citations || {}).toEqual({});
    expect(result.documents).toEqual(null);
    expect(result.isComplete).toBe(false);
  });

  it('should process text message packets', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_START,
          id: 'msg1',
          content: 'Hello world',
          final_documents: null,
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.groupedPackets).toHaveLength(1);
    expect(result.displayPackets).toContain(0);
    expect(result.groupedPackets[0].packets[0].obj.content).toBe('Hello world');
  });

  it('should process search tool packets', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.SEARCH_TOOL_START,
          search_query: 'test query',
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.groupedPackets).toHaveLength(1);
    expect(result.toolPackets).toContain(0);
  });

  it('should process citation packets', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.CITATION_DELTA,
          citations: [{ citation_num: 1, document_id: 'doc123' }],
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.citations).toEqual({ 1: 'doc123' });
  });

  it('should process document packets', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.SEARCH_TOOL_DELTA,
          documents: [
            {
              document_id: 'doc123',
              semantic_identifier: 'Test Document',
              link: 'https://example.com',
            },
          ],
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].document_id).toBe('doc123');
  });

  it('should process error packets', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.ERROR,
          error: 'Something went wrong',
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.error).toBe('Something went wrong');
  });

  it('should mark as complete when stop packet received', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_DELTA,
          content: 'Hello',
        },
      },
      {
        ind: 1,
        obj: {
          type: PacketType.STOP,
        },
      },
    ];

    processor.addPackets(packets);
    const result = processor.getMessage();
    expect(result.isComplete).toBe(true);
  });

  it('should reset processor state', () => {
    const packets = [
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_DELTA,
          content: 'Hello',
        },
      },
    ];

    processor.addPackets(packets);
    processor.reset();

    const result = processor.getMessage();
    expect(result.groupedPackets).toEqual([]);
    expect(result.documents).toEqual(null);
    expect(result.citations || {}).toEqual({});
  });

  it('should process MESSAGE_END_ID_INFO packets and expose messageIds', () => {
    processor.addPackets([
      {
        ind: -1,
        obj: {
          type: PacketType.MESSAGE_END_ID_INFO,
          user_message_id: 42,
          reserved_assistant_message_id: 43,
        },
      },
    ]);

    expect(processor.messageIds).toEqual({
      userMessageId: 42,
      assistantMessageId: 43,
    });
  });

  it('should set isFinalMessageComing on MESSAGE_START', () => {
    expect(processor.isFinalMessageComing).toBe(false);

    processor.addPackets([
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_START,
          id: 'msg1',
          content: 'Hi',
          final_documents: null,
        },
      },
    ]);

    expect(processor.isFinalMessageComing).toBe(true);
  });

  it('should set isFinalMessageComing on IMAGE_GENERATION_TOOL_START', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: { type: PacketType.IMAGE_GENERATION_TOOL_START },
      },
    ]);

    expect(processor.isFinalMessageComing).toBe(true);
  });

  it('should handle SECTION_END with synthetic packet mapping', () => {
    // First start an index, then send SECTION_END
    processor.addPackets([
      {
        ind: 5,
        obj: {
          type: PacketType.SEARCH_TOOL_START,
        },
      },
    ]);

    // SECTION_END should get remapped to ind=5
    processor.addPackets([
      {
        ind: -1,
        obj: { type: PacketType.SECTION_END },
      },
    ]);

    const result = processor.getMessage();
    // The SECTION_END should be stored with ind=5
    const sectionEndPackets = result.packets.filter(
      (p) => p.obj.type === PacketType.SECTION_END,
    );
    expect(sectionEndPackets).toHaveLength(1);
    expect(sectionEndPackets[0].ind).toBe(5);
  });

  it('should skip SECTION_END when no indices started', () => {
    processor.addPackets([
      {
        ind: -1,
        obj: { type: PacketType.SECTION_END },
      },
    ]);

    const result = processor.getMessage();
    expect(result.packets).toHaveLength(0);
  });

  it('should extract tool call from search tool packets on complete', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: { type: PacketType.SEARCH_TOOL_START },
      },
      {
        ind: 0,
        obj: {
          type: PacketType.SEARCH_TOOL_DELTA,
          documents: [
            {
              document_id: 'doc1',
              semantic_identifier: 'Doc 1',
              link: 'http://example.com',
              blurb: 'some content',
            },
          ],
        },
      },
      {
        ind: -1,
        obj: { type: PacketType.SECTION_END },
      },
      {
        ind: 1,
        obj: {
          type: PacketType.MESSAGE_START,
          id: 'msg1',
          content: 'Answer',
          final_documents: null,
        },
      },
      { ind: 2, obj: { type: PacketType.STOP } },
    ]);

    const result = processor.getMessage();
    expect(result.isComplete).toBe(true);
    expect(result.toolCall).not.toBeNull();
    expect(result.toolCall.tool_name).toBe('run_search');
    expect(result.toolCall.tool_result).toHaveLength(1);
    expect(result.toolCall.tool_result[0].document_id).toBe('doc1');
  });

  it('should return null toolCall when no search tool packets', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: { type: PacketType.MESSAGE_DELTA, content: 'Hello' },
      },
      { ind: 1, obj: { type: PacketType.STOP } },
    ]);

    const result = processor.getMessage();
    expect(result.isComplete).toBe(true);
    expect(result.toolCall).toBeNull();
  });

  it('should deduplicate documents by document_id', () => {
    const doc = {
      document_id: 'dup1',
      semantic_identifier: 'Doc',
      link: 'http://example.com',
    };

    processor.addPackets([
      { ind: 0, obj: { type: PacketType.SEARCH_TOOL_DELTA, documents: [doc] } },
      { ind: 0, obj: { type: PacketType.SEARCH_TOOL_DELTA, documents: [doc] } },
    ]);

    const result = processor.getMessage();
    expect(result.documents).toHaveLength(1);
  });

  it('should deduplicate citations by citation_num', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: {
          type: PacketType.CITATION_DELTA,
          citations: [{ citation_num: 1, document_id: 'doc1' }],
        },
      },
      {
        ind: 0,
        obj: {
          type: PacketType.CITATION_DELTA,
          citations: [{ citation_num: 1, document_id: 'doc2' }],
        },
      },
    ]);

    const result = processor.getMessage();
    // First citation wins
    expect(result.citations).toEqual({ 1: 'doc1' });
  });

  it('should accumulate text from MESSAGE_START and MESSAGE_DELTA', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_START,
          id: 'msg1',
          content: 'Hello ',
          final_documents: null,
        },
      },
      {
        ind: 0,
        obj: { type: PacketType.MESSAGE_DELTA, content: 'world' },
      },
    ]);

    const result = processor.getMessage();
    expect(result.message).toBe('Hello world');
  });

  it('should process documents from FETCH_TOOL_START', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: {
          type: PacketType.FETCH_TOOL_START,
          documents: [
            {
              document_id: 'fetch1',
              semantic_identifier: 'Fetched',
              link: 'http://fetch.com',
            },
          ],
          queries: null,
        },
      },
    ]);

    const result = processor.getMessage();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].document_id).toBe('fetch1');
  });

  it('should process documents from MESSAGE_START final_documents', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: {
          type: PacketType.MESSAGE_START,
          id: 'msg1',
          content: 'Hello',
          final_documents: [
            {
              document_id: 'fd1',
              semantic_identifier: 'Final Doc',
              link: 'http://final.com',
            },
          ],
        },
      },
    ]);

    const result = processor.getMessage();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].document_id).toBe('fd1');
  });

  it('should mark complete on ERROR packet', () => {
    processor.addPackets([
      {
        ind: 0,
        obj: { type: PacketType.ERROR, error: 'fail' },
      },
    ]);

    expect(processor.isComplete).toBe(true);
  });

  it('should return null toolCall when search has no documents', () => {
    processor.addPackets([
      { ind: 0, obj: { type: PacketType.SEARCH_TOOL_START } },
      {
        ind: 0,
        obj: { type: PacketType.SEARCH_TOOL_DELTA, documents: [] },
      },
      { ind: 1, obj: { type: PacketType.STOP } },
    ]);

    const result = processor.getMessage();
    expect(result.toolCall).toBeNull();
  });

  it('should set nodeId and parentNodeId from constructor', () => {
    const p = new MessageProcessor(10, 5);
    const msg = p.getMessage();
    expect(msg.nodeId).toBe(10);
    expect(msg.parentNodeId).toBe(5);
  });
});
