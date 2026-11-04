import {
  getExportFilename,
  extractMessageSources,
  generateMarkdownContent,
  exportConversationAsMarkdown,
  exportConversationAsPdf,
  parseMarkdownToDocxParagraphs,
  exportConversationAsDocx,
} from '@eeacms/volto-eea-chatbot/ChatBlock/utils/exportUtils';

describe('exportUtils', () => {
  const mockPersona = {
    id: 1,
    name: 'EEA Green Guru',
    description: 'Expert on European environmental data.',
  };

  const mockMessages = [
    {
      messageId: 1,
      nodeId: 1,
      message: 'What is PM2.5?',
      type: 'user',
      files: [],
      toolCall: null,
      parentNodeId: null,
      packets: [],
    },
    {
      messageId: 2,
      nodeId: 2,
      message:
        'PM2.5 refers to fine particulate matter with a diameter of 2.5 micrometers or less.\n\n* Health impact: penetrates lungs\n* Sources: transport and heating',
      type: 'assistant',
      files: [],
      toolCall: {
        tool_name: 'internal_search',
        tool_args: { query: 'PM2.5' },
        tool_result: [
          {
            title: 'Air Quality in Europe 2024',
            link: 'https://www.eea.europa.eu/en/air-quality-2024',
          },
        ],
      },
      documents: [
        {
          document_id: 'doc-1',
          semantic_identifier: 'Air pollution and health report',
          link: 'https://www.eea.europa.eu/en/reports/air-health',
          blurb: 'Summary of air health impact',
          source_type: 'web',
          updated_at: null,
          match_highlights: [],
        },
      ],
      parentNodeId: 1,
      packets: [],
    },
  ];

  describe('getExportFilename', () => {
    it('generates filename with slugified persona name and timestamp', () => {
      const filename = getExportFilename(mockPersona, 'md');
      expect(filename).toMatch(/^eea-chat-eea-green-guru-\d{8}-\d{4}\.md$/);
    });

    it('defaults to conversation when persona is undefined', () => {
      const filename = getExportFilename(undefined, 'docx');
      expect(filename).toMatch(/^eea-chat-conversation-\d{8}-\d{4}\.docx$/);
    });
  });

  describe('extractMessageSources', () => {
    it('extracts sources from documents and tool_result deduplicating them', () => {
      const sources = extractMessageSources(mockMessages[1]);
      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        title: 'Air pollution and health report',
        url: 'https://www.eea.europa.eu/en/reports/air-health',
      });
      expect(sources[1]).toEqual({
        title: 'Air Quality in Europe 2024',
        url: 'https://www.eea.europa.eu/en/air-quality-2024',
      });
    });

    it('prioritizes citations map when present to export only cited sources in order', () => {
      const messageWithCitations = {
        ...mockMessages[1],
        citations: { 2: 'doc-2', 1: 'doc-1' },
        documents: [
          {
            document_id: 'doc-1',
            semantic_identifier: 'Document One',
            link: 'https://example.com/1',
          },
          {
            document_id: 'doc-2',
            semantic_identifier: 'Document Two',
            link: 'https://example.com/2',
          },
          {
            document_id: 'doc-3',
            semantic_identifier: 'Document Three (uncited)',
            link: 'https://example.com/3',
          },
        ],
      };

      const sources = extractMessageSources(messageWithCitations);
      expect(sources).toHaveLength(2);
      expect(sources[0].title).toBe('Document One');
      expect(sources[0].citationIndex).toBe(1);
      expect(sources[1].title).toBe('Document Two');
      expect(sources[1].citationIndex).toBe(2);
    });

    it('preserves non-consecutive citation numbers like [6] and [7] in order', () => {
      const messageWithHighCitations = {
        ...mockMessages[1],
        message: 'Direct persecution is a major threat [6][7].',
        citations: {
          6: 'https://www.eea.europa.eu/signals-2021',
          7: 'https://www.eea.europa.eu/pressures-threats',
        },
        documents: [
          {
            document_id: 'https://www.eea.europa.eu/signals-2021',
            semantic_identifier: "SIGNALS 2021 Europe's nature",
            link: 'https://www.eea.europa.eu/signals-2021',
          },
          {
            document_id: 'https://www.eea.europa.eu/pressures-threats',
            semantic_identifier: 'Habitats and species pressures',
            link: 'https://www.eea.europa.eu/pressures-threats',
          },
        ],
      };

      const sources = extractMessageSources(messageWithHighCitations);
      expect(sources).toHaveLength(2);
      expect(sources[0].citationIndex).toBe(6);
      expect(sources[0].title).toBe("SIGNALS 2021 Europe's nature");
      expect(sources[1].citationIndex).toBe(7);
      expect(sources[1].title).toBe('Habitats and species pressures');

      const md = generateMarkdownContent([messageWithHighCitations]);
      expect(md).toContain("[6] [SIGNALS 2021 Europe's nature]");
      expect(md).toContain('[7] [Habitats and species pressures]');
    });

    it('returns empty array when message has no documents or tool results', () => {
      const sources = extractMessageSources(mockMessages[0]);
      expect(sources).toEqual([]);
    });
  });

  describe('generateMarkdownContent', () => {
    it('formats entire conversation as structured markdown', () => {
      const md = generateMarkdownContent(mockMessages, mockPersona);

      expect(md).toContain('# EEA Green Guru - Conversation Export');
      expect(md).toContain('> Expert on European environmental data.');
      expect(md).toContain('### User\n\nWhat is PM2.5?');
      expect(md).toContain('### EEA Green Guru');
      expect(md).toContain('#### Sources & References');
      expect(md).toContain(
        '[Air pollution and health report](https://www.eea.europa.eu/en/reports/air-health)',
      );
      expect(md).toContain(
        '[Air Quality in Europe 2024](https://www.eea.europa.eu/en/air-quality-2024)',
      );
    });
  });

  describe('exportConversationAsMarkdown', () => {
    it('creates Blob and triggers download in browser', () => {
      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;

      window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = jest.fn();

      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click');

      exportConversationAsMarkdown(mockMessages, mockPersona);

      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    });
  });

  describe('exportConversationAsPdf', () => {
    it('calls window.print', () => {
      const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
      exportConversationAsPdf();
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });

  describe('parseMarkdownToDocxParagraphs', () => {
    const mockDocxLib = {
      Paragraph: jest.fn().mockImplementation((opts) => ({ ...opts })),
      TextRun: jest.fn().mockImplementation((opts) => ({ ...opts })),
      ExternalHyperlink: jest.fn().mockImplementation((opts) => ({ ...opts })),
      HeadingLevel: {
        HEADING_1: 'Heading1',
        HEADING_2: 'Heading2',
        HEADING_3: 'Heading3',
      },
    };

    it('parses headings and bullet lists into docx Paragraphs', () => {
      const text =
        '# Main Title\n\n## Subtitle\n\n* Item 1\n* Item 2\n\nPlain text with **bold** and [link](https://eea.europa.eu)';
      const paragraphs = parseMarkdownToDocxParagraphs(text, mockDocxLib);

      expect(paragraphs.length).toBeGreaterThanOrEqual(4);
      expect(mockDocxLib.HeadingLevel.HEADING_1).toBe('Heading1');
    });

    it('parses markdown tables into docx Table objects when Table is available', () => {
      const mockDocxWithTable = {
        ...mockDocxLib,
        Table: jest
          .fn()
          .mockImplementation((opts) => ({ ...opts, type: 'Table' })),
        TableRow: jest.fn().mockImplementation((opts) => ({ ...opts })),
        TableCell: jest.fn().mockImplementation((opts) => ({ ...opts })),
        WidthType: { PERCENTAGE: 'pct' },
        BorderStyle: { SINGLE: 'single' },
      };

      const tableMarkdown = `
| Header A | Header B |
| --- | --- |
| Cell 1 | Cell 2 with [[1]](https://eea.europa.eu) |
`;
      const elements = parseMarkdownToDocxParagraphs(
        tableMarkdown,
        mockDocxWithTable,
      );
      expect(mockDocxWithTable.Table).toHaveBeenCalled();
      expect(mockDocxWithTable.TableRow).toHaveBeenCalled();
      expect(mockDocxWithTable.TableCell).toHaveBeenCalled();
      expect(elements.some((el) => el.type === 'Table')).toBe(true);
    });

    it('cleans <br> tags in table cells and converts them to bullet paragraphs without literal <br>', () => {
      const mockDocxWithTable = {
        ...mockDocxLib,
        Table: jest
          .fn()
          .mockImplementation((opts) => ({ ...opts, type: 'Table' })),
        TableRow: jest.fn().mockImplementation((opts) => ({ ...opts })),
        TableCell: jest.fn().mockImplementation((opts) => ({ ...opts })),
        WidthType: { PERCENTAGE: 'pct' },
        BorderStyle: { SINGLE: 'single' },
      };

      const tableWithBr = `
| Group | Drivers |
| --- | --- |
| Insects | • Pesticides <br> • Habitat loss <br> • Climate change |
`;
      parseMarkdownToDocxParagraphs(tableWithBr, mockDocxWithTable);

      const textRunCalls = mockDocxWithTable.TextRun.mock.calls;
      const hasLiteralBr = textRunCalls.some(
        (call) =>
          call[0] &&
          typeof call[0].text === 'string' &&
          call[0].text.includes('<br>'),
      );
      expect(hasLiteralBr).toBe(false);
    });
  });

  describe('exportConversationAsDocx', () => {
    it('builds docx Document and triggers Packer.toBlob', async () => {
      const mockBlob = new Blob(['mock-docx'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const mockDocxLib = {
        Document: jest.fn().mockImplementation((opts) => ({ ...opts })),
        Packer: {
          toBlob: jest.fn().mockResolvedValue(mockBlob),
        },
        Paragraph: jest.fn().mockImplementation((opts) => ({ ...opts })),
        TextRun: jest.fn().mockImplementation((opts) => ({ ...opts })),
        ExternalHyperlink: jest
          .fn()
          .mockImplementation((opts) => ({ ...opts })),
        HeadingLevel: {
          TITLE: 'Title',
          HEADING_1: 'Heading1',
          HEADING_2: 'Heading2',
          HEADING_3: 'Heading3',
        },
      };

      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;
      window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = jest.fn();
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click');

      await exportConversationAsDocx(mockMessages, mockPersona, mockDocxLib);

      expect(mockDocxLib.Packer.toBlob).toHaveBeenCalled();
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();

      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      clickSpy.mockRestore();
    });
  });
});
