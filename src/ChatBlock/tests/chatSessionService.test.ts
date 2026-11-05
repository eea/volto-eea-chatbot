import {
  getSharedChatSession,
  deserializeChatSession,
  getShareableLink,
  copyShareLink,
  type SharedChatSessionResponse,
} from '../services/chatSessionService';
import { isFinalAnswerComplete } from '../services/packetUtils';

describe('chatSessionService', () => {
  describe('getSharedChatSession', () => {
    it('fetches shared conversation from the proxy endpoint', async () => {
      const mockResponse: SharedChatSessionResponse = {
        chat_session_id: '46277749-db60-44f2-9de1-c5dca2eb68fa',
        description: 'Test session',
        persona_id: 1,
        messages: [],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getSharedChatSession(
        '46277749-db60-44f2-9de1-c5dca2eb68fa',
        mockFetch as any,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        '/_da/chat/get-chat-session/46277749-db60-44f2-9de1-c5dca2eb68fa',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws error when response is not ok', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        getSharedChatSession('non-existent-uuid', mockFetch as any),
      ).rejects.toThrow('Failed to load shared conversation (404 Not Found)');
    });
  });

  describe('deserializeChatSession', () => {
    it('returns empty array when sessionDetail is null or has no messages', () => {
      expect(deserializeChatSession(null as any)).toEqual([]);
      expect(
        deserializeChatSession({
          chat_session_id: '123',
          messages: [],
        } as any),
      ).toEqual([]);
    });

    it('filters out system messages and reconstructs user and assistant messages', () => {
      const sessionDetail: SharedChatSessionResponse = {
        chat_session_id: 'session-123',
        description: 'Air Quality Conversation',
        persona_id: 2,
        messages: [
          {
            message_id: 1,
            message_type: 'system',
            message: 'You are a helpful assistant.',
          },
          {
            message_id: 2,
            message_type: 'user',
            message: 'What is PM2.5?',
            parent_message: null,
            latest_child_message: 3,
            time_sent: '2026-11-05T10:00:00Z',
          },
          {
            message_id: 3,
            message_type: 'assistant',
            message: 'PM2.5 refers to fine particulate matter [1].',
            parent_message: 2,
            latest_child_message: null,
            context_docs: [
              {
                document_id: 'doc-1',
                semantic_identifier: 'Air Quality Guide',
                link: 'https://eea.europa.eu/air',
                blurb: 'PM2.5 description',
                source_type: 'web',
              },
            ],
            citations: {
              '1': 'doc-1',
            },
            time_sent: '2026-11-05T10:00:05Z',
          },
        ],
      };

      const messages = deserializeChatSession(sessionDetail);

      expect(messages).toHaveLength(2);

      // User message
      expect(messages[0]).toMatchObject({
        messageId: 2,
        nodeId: 2,
        type: 'user',
        message: 'What is PM2.5?',
        parentNodeId: null,
        latestChildNodeId: 3,
        isComplete: true,
        packets: [],
      });

      // Assistant message
      expect(messages[1]).toMatchObject({
        messageId: 3,
        nodeId: 3,
        type: 'assistant',
        message: 'PM2.5 refers to fine particulate matter [1].',
        parentNodeId: 2,
        latestChildNodeId: null,
        isComplete: true,
        citations: { '1': 'doc-1' },
      });

      // Assistant documents mapped
      expect(messages[1].documents).toHaveLength(1);
      expect(messages[1].documents?.[0]).toEqual({
        document_id: 'doc-1',
        semantic_identifier: 'Air Quality Guide',
        link: 'https://eea.europa.eu/air',
        blurb: 'PM2.5 description',
        source_type: 'web',
        updated_at: null,
        match_highlights: [],
        db_doc_id: undefined,
        score: undefined,
      });

      // Synthesized packets satisfy isFinalAnswerComplete
      expect(messages[1].packets).toBeDefined();
      expect(isFinalAnswerComplete(messages[1].packets)).toBe(true);

      // Display groups set up properly
      expect(messages[1].displayPackets).toEqual([0]);
      expect(messages[1].groupedPackets).toHaveLength(1);
      expect(messages[1].groupedPackets?.[0].ind).toBe(0);
    });

    it('handles context_docs wrapped in top_documents', () => {
      const sessionDetail: SharedChatSessionResponse = {
        chat_session_id: 'session-456',
        messages: [
          {
            message_id: 1,
            message_type: 'assistant',
            message: 'Answer with wrapped docs',
            context_docs: {
              top_documents: [
                {
                  document_id: 'top-doc-1',
                  semantic_identifier: 'Top Document',
                  link: 'https://eea.europa.eu/top',
                  blurb: 'Top document blurb',
                },
              ],
            },
          },
        ],
      };

      const messages = deserializeChatSession(sessionDetail);
      expect(messages[0].documents).toHaveLength(1);
      expect(messages[0].documents?.[0].document_id).toBe('top-doc-1');
    });
  });

  describe('getShareableLink', () => {
    it('constructs url with ?chat= query param', () => {
      const link = getShareableLink(
        '46277749-db60-44f2-9de1-c5dca2eb68fa',
        'https://www.eea.europa.eu',
        '/en/ask-ai',
      );
      expect(link).toBe(
        'https://www.eea.europa.eu/en/ask-ai?chat=46277749-db60-44f2-9de1-c5dca2eb68fa',
      );
    });
  });

  describe('copyShareLink', () => {
    const originalClipboard = navigator.clipboard;

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      });
    });

    it('writes link to clipboard via navigator.clipboard when available', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
      });

      const success = await copyShareLink('uuid-1234');
      expect(success).toBe(true);
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('?chat=uuid-1234'),
      );
    });

    it('falls back to execCommand when clipboard API is unavailable', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      const execCommandMock = jest.fn().mockReturnValue(true);
      (document as any).execCommand = execCommandMock;

      const success = await copyShareLink('uuid-fallback');
      expect(success).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
      delete (document as any).execCommand;
    });
  });
});
