import type {
  Message,
  Persona,
} from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';
import { addCitations } from '@eeacms/volto-eea-chatbot/ChatBlock/utils/citations';
import { marked } from 'marked';

export interface ExportSource {
  citationIndex?: number | string;
  title: string;
  url?: string;
}

/**
 * Generates a clean, timestamped export filename.
 */
export function getExportFilename(
  persona?: { name?: string },
  extension: string = 'md',
): string {
  const safeName = (persona?.name || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `eea-chat-${safeName}-${dateStr}.${extension}`;
}

/**
 * Triggers a native browser file download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Extracts and deduplicates sources from a message (documents array, citations map, and tool results).
 */
export function extractMessageSources(message: Message): ExportSource[] {
  const sources: ExportSource[] = [];
  const seenKeys = new Set<string>();

  const allDocs = [
    ...(Array.isArray(message.documents) ? message.documents : []),
    ...((message.toolCall?.tool_result as any[]) || []),
    ...(message.toolCalls || []).flatMap((tc: any) => tc?.tool_result || []),
  ];

  const docMap = new Map<string, any>();
  allDocs.forEach((doc) => {
    if (doc?.document_id) {
      docMap.set(String(doc.document_id), doc);
    }
    if (doc?.id) {
      docMap.set(String(doc.id), doc);
    }
    if (doc?.link) {
      docMap.set(String(doc.link), doc);
    }
  });

  // Collect all citations mentioned in message.citations or in the message text itself
  const citationMap = new Map<number, { docId?: string; url?: string }>();

  if (message.citations && typeof message.citations === 'object') {
    Object.entries(message.citations).forEach(([key, val]) => {
      const num = parseInt(key, 10);
      if (!isNaN(num) && val) {
        citationMap.set(num, { docId: String(val) });
      }
    });
  }

  // Also scan message text for citation markers like [6], [[6]](url)
  const textCitationMatches = Array.from(
    (message.message || '').matchAll(/\[\[?(\d+)\]?\](?:\(([^)]+)\))?/g),
  );
  textCitationMatches.forEach((match) => {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      const existing = citationMap.get(num) || {};
      if (match[2]) {
        existing.url = match[2];
      }
      citationMap.set(num, existing);
    }
  });

  if (citationMap.size > 0) {
    const sortedIndices = Array.from(citationMap.keys()).sort((a, b) => a - b);

    sortedIndices.forEach((index) => {
      const { docId, url: textUrl } = citationMap.get(index)!;
      let doc = docId ? docMap.get(docId) : undefined;
      if (!doc && textUrl) {
        doc = docMap.get(textUrl);
      }

      let title: string | undefined = doc?.semantic_identifier || doc?.title;
      let url: string | undefined = doc?.link || textUrl;

      if (
        !url &&
        docId &&
        (docId.startsWith('http://') || docId.startsWith('https://'))
      ) {
        url = docId;
      }

      if (!title) {
        if (url) {
          title = url;
        } else {
          title = `Source [${index}]`;
        }
      }

      sources.push({
        citationIndex: index,
        title: title.trim(),
        url: url?.trim(),
      });
    });

    if (sources.length > 0) {
      return sources;
    }
  }

  // Fallback if no citations map or markers are present
  allDocs.forEach((doc) => {
    if (doc && (doc.link || doc.semantic_identifier || doc.title)) {
      const cleanTitle = (
        doc.semantic_identifier ||
        doc.title ||
        doc.link ||
        'Source document'
      ).trim();
      const cleanUrl = (doc.link || '').trim();
      const key = cleanUrl || cleanTitle;
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        sources.push({
          title: cleanTitle,
          url: cleanUrl || undefined,
        });
      }
    }
  });

  return sources;
}

/**
 * Generates formatted Markdown string representing the chat conversation.
 */
export function generateMarkdownContent(
  messages: Message[],
  persona?: Persona,
): string {
  const lines: string[] = [];
  const assistantName = persona?.name || 'EEA Assistant';

  // Title & Metadata Header
  lines.push(`# ${assistantName} - Conversation Export`);
  lines.push('');
  lines.push(`*Exported on ${new Date().toLocaleString()}*`);
  if (persona?.description) {
    lines.push('');
    lines.push(`> ${persona.description}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Conversation turns
  messages.forEach((msg) => {
    if (msg.type === 'user') {
      lines.push('### User');
      lines.push('');
      lines.push(msg.message || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    } else if (msg.type === 'assistant') {
      lines.push(`### ${assistantName}`);
      lines.push('');
      const messageText = addCitations(msg.message || '', msg);
      lines.push(messageText);
      lines.push('');

      const sources = extractMessageSources(msg);
      if (sources.length > 0) {
        lines.push('#### Sources & References');
        lines.push('');
        sources.forEach((source, idx) => {
          const prefix =
            source.citationIndex !== undefined
              ? `[${source.citationIndex}]`
              : `${idx + 1}.`;
          if (source.url) {
            lines.push(`${prefix} [${source.title}](${source.url})`);
          } else {
            lines.push(`${prefix} ${source.title}`);
          }
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Exports conversation as a Markdown (.md) file download.
 */
export function exportConversationAsMarkdown(
  messages: Message[],
  persona?: Persona,
  customFilename?: string,
): void {
  const content = generateMarkdownContent(messages, persona);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const filename = customFilename || getExportFilename(persona, 'md');
  downloadBlob(blob, filename);
}

/**
 * Triggers native browser print dialog for Save to PDF.
 */
export function exportConversationAsPdf(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

/**
 * Decodes HTML entities (e.g. &quot;, &amp;) produced by markdown tokenizers.
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Recursively converts marked AST inline tokens into docx TextRun and ExternalHyperlink elements.
 */
function tokensToRuns(
  tokens: any[],
  docxLib: any,
  inherited: {
    bold?: boolean;
    italics?: boolean;
    strike?: boolean;
    color?: string;
  } = {},
): any[] {
  const { TextRun, ExternalHyperlink } = docxLib;
  const runs: any[] = [];

  for (const token of tokens || []) {
    switch (token.type) {
      case 'text':
      case 'escape':
        if (token.tokens && token.tokens.length > 0) {
          runs.push(...tokensToRuns(token.tokens, docxLib, inherited));
        } else if (token.text) {
          runs.push(
            new TextRun({ text: decodeHtmlEntities(token.text), ...inherited }),
          );
        }
        break;

      case 'strong':
        runs.push(
          ...tokensToRuns(token.tokens, docxLib, { ...inherited, bold: true }),
        );
        break;

      case 'em':
        runs.push(
          ...tokensToRuns(token.tokens, docxLib, {
            ...inherited,
            italics: true,
          }),
        );
        break;

      case 'del':
        runs.push(
          ...tokensToRuns(token.tokens, docxLib, {
            ...inherited,
            strike: true,
          }),
        );
        break;

      case 'codespan':
        runs.push(
          new TextRun({
            text: decodeHtmlEntities(token.text),
            font: 'Courier New',
            shading: { fill: 'F1F5F9' },
          }),
        );
        break;

      case 'link':
        runs.push(
          new ExternalHyperlink({
            children: tokensToRuns(
              token.tokens || [{ type: 'text', text: token.text }],
              docxLib,
              {
                ...inherited,
                style: 'Hyperlink',
                color: '004B87',
                underline: {},
              },
            ),
            link: token.href,
          }),
        );
        break;

      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;

      case 'html':
        if (/<br\s*\/?>/i.test(token.text)) {
          runs.push(new TextRun({ break: 1 }));
        }
        break;

      default:
        if (token.tokens && token.tokens.length > 0) {
          runs.push(...tokensToRuns(token.tokens, docxLib, inherited));
        } else if (token.text) {
          runs.push(
            new TextRun({ text: decodeHtmlEntities(token.text), ...inherited }),
          );
        }
        break;
    }
  }

  return runs;
}

/**
 * Converts table cell tokens into docx Paragraph objects.
 * Handles bullet points, <br> line breaks, and whitespace normalization.
 */
function cellTokensToParagraphs(tokens: any[], docxLib: any): any[] {
  const { Paragraph, TextRun } = docxLib;
  const lines: any[][] = [[]];

  for (const token of tokens || []) {
    if (
      (token.type === 'html' && /<br\s*\/?>/i.test(token.text)) ||
      token.type === 'br'
    ) {
      lines.push([]);
    } else if (token.type === 'text' && token.text.includes('\n')) {
      const parts = token.text.split('\n');
      parts.forEach((part: string, idx: number) => {
        if (idx > 0) lines.push([]);
        if (part) {
          lines[lines.length - 1].push({ ...token, text: part, raw: part });
        }
      });
    } else {
      lines[lines.length - 1].push(token);
    }
  }

  const paragraphs: any[] = [];
  for (const lineTokens of lines) {
    if (lineTokens.length === 0) continue;

    let isBullet = false;
    const first = lineTokens[0];
    if (first.type === 'text' && /^\s*[•\-\*]\s*/.test(first.text)) {
      isBullet = true;
      first.text = first.text.replace(/^\s*[•\-\*]\s*/, '');
      if (!first.text) {
        lineTokens.shift();
      }
    }

    const runs = tokensToRuns(lineTokens, docxLib);
    if (runs.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: runs,
          bullet: isBullet ? { level: 0 } : undefined,
          spacing: { before: 40, after: 40 },
        }),
      );
    }
  }

  return paragraphs.length > 0
    ? paragraphs
    : [new Paragraph({ children: [new TextRun({ text: '' })] })];
}

/**
 * Parses markdown text into docx Paragraph and Table objects via marked AST.
 */
export function parseMarkdownToDocxParagraphs(
  text: string,
  docxLib: any,
): any[] {
  const {
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = docxLib;
  const elements: any[] = [];
  const tokens = marked.lexer(text || '');

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const headingMap: Record<number, any> = {
          1: HeadingLevel?.HEADING_1,
          2: HeadingLevel?.HEADING_2,
          3: HeadingLevel?.HEADING_3,
          4: HeadingLevel?.HEADING_4,
          5: HeadingLevel?.HEADING_5,
          6: HeadingLevel?.HEADING_6,
        };
        const runs = tokensToRuns(token.tokens, docxLib);
        elements.push(
          new Paragraph({
            children: runs,
            heading: headingMap[token.depth] || HeadingLevel?.HEADING_3,
            spacing: { before: 240, after: 120 },
          }),
        );
        break;
      }

      case 'paragraph': {
        const runs = tokensToRuns(token.tokens, docxLib);
        if (runs.length > 0) {
          elements.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120 },
            }),
          );
        }
        break;
      }

      case 'list': {
        token.items?.forEach((item: any, idx: number) => {
          const itemTokens =
            item.tokens?.[0]?.type === 'text' ||
            item.tokens?.[0]?.type === 'paragraph'
              ? item.tokens[0].tokens || item.tokens
              : item.tokens;

          const runs = tokensToRuns(itemTokens, docxLib);
          if (token.ordered) {
            elements.push(
              new Paragraph({
                children: [new TextRun({ text: `${idx + 1}. ` }), ...runs],
                spacing: { after: 60 },
              }),
            );
          } else {
            elements.push(
              new Paragraph({
                children: runs,
                bullet: { level: 0 },
                spacing: { after: 60 },
              }),
            );
          }
        });
        break;
      }

      case 'table': {
        if (Table && TableRow && TableCell) {
          const rows: any[] = [];

          // Header row
          rows.push(
            new TableRow({
              tableHeader: true,
              children: token.header.map((headerCell: any) =>
                new TableCell({
                  shading: { fill: 'F1F5F9' },
                  margins: { top: 120, bottom: 120, left: 140, right: 140 },
                  children: cellTokensToParagraphs(headerCell.tokens, docxLib),
                }),
              ),
            }),
          );

          // Data rows
          token.rows.forEach((rowCells: any[]) => {
            rows.push(
              new TableRow({
                children: rowCells.map((cell: any) =>
                  new TableCell({
                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                    children: cellTokensToParagraphs(cell.tokens, docxLib),
                  }),
                ),
              }),
            );
          });

          elements.push(
            new Table({
              width: {
                size: 100,
                type: WidthType ? WidthType.PERCENTAGE : 'pct',
              },
              borders: {
                top: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'CBD5E1',
                },
                bottom: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'CBD5E1',
                },
                left: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'CBD5E1',
                },
                right: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'CBD5E1',
                },
                insideHorizontal: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'E2E8F0',
                },
                insideVertical: {
                  style: BorderStyle ? BorderStyle.SINGLE : 'single',
                  size: 4,
                  color: 'E2E8F0',
                },
              },
              rows,
            }),
          );
          elements.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        }
        break;
      }

      case 'code': {
        const codeLines = (token.text || '').split('\n');
        codeLines.forEach((codeLine: string) => {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: codeLine || ' ',
                  font: 'Courier New',
                  size: 18,
                  color: '0F172A',
                }),
              ],
              shading: { fill: 'F8FAFC' },
              spacing: { after: 20 },
            }),
          );
        });
        break;
      }

      case 'blockquote': {
        const runs = tokensToRuns(token.tokens, docxLib, { italics: true });
        elements.push(
          new Paragraph({
            children: runs,
            indent: { left: 720 },
            spacing: { before: 120, after: 120 },
          }),
        );
        break;
      }

      case 'space':
      case 'hr':
      default:
        break;
    }
  }

  return elements;
}

/**
 * Builds and downloads a native OpenXML (.docx) file from conversation messages.
 */
export async function exportConversationAsDocx(
  messages: Message[],
  persona: Persona | undefined,
  docxLib: any,
  customFilename?: string,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink } = docxLib;

  const assistantName = persona?.name || 'EEA Assistant';
  const children: any[] = [];

  // Header Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: assistantName,
          bold: true,
          size: 36,
          color: '004B87',
        }),
      ],
      spacing: { after: 60 },
    }),
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Conversation Export',
          size: 22,
          color: '475569',
        }),
      ],
      spacing: { after: 140 },
    }),
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported on: ${new Date().toLocaleString()}`,
          italics: true,
          size: 19,
          color: '64748B',
        }),
      ],
      spacing: { after: persona?.description ? 120 : 300 },
    }),
  );

  if (persona?.description) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: persona.description,
            italics: true,
            size: 20,
            color: '334155',
          }),
        ],
        spacing: { after: 360 },
      }),
    );
  }

  // Conversation turns
  messages.forEach((msg) => {
    if (msg.type === 'user') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'User',
              bold: true,
              size: 24,
              color: '0F172A',
            }),
          ],
          spacing: { before: 360, after: 120 },
        }),
      );
      const elements = parseMarkdownToDocxParagraphs(
        msg.message || '',
        docxLib,
      );
      children.push(...elements);
    } else if (msg.type === 'assistant') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: assistantName,
              bold: true,
              size: 24,
              color: '004B87',
            }),
          ],
          spacing: { before: 360, after: 120 },
        }),
      );

      const messageText = addCitations(msg.message || '', msg);
      const elements = parseMarkdownToDocxParagraphs(messageText, docxLib);
      children.push(...elements);

      const sources = extractMessageSources(msg);
      if (sources.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Sources & References',
                bold: true,
                size: 22,
                color: '0F172A',
              }),
            ],
            spacing: { before: 240, after: 120 },
          }),
        );

        sources.forEach((source, idx) => {
          const prefix =
            source.citationIndex !== undefined
              ? `[${source.citationIndex}] `
              : `${idx + 1}. `;

          if (source.url) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: prefix, bold: true }),
                  new ExternalHyperlink({
                    children: [
                      new TextRun({
                        text: source.title,
                        style: 'Hyperlink',
                        color: '004B87',
                        underline: {},
                      }),
                    ],
                    link: source.url,
                  }),
                ],
                spacing: { after: 80 },
              }),
            );
          } else {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: prefix, bold: true }),
                  new TextRun({ text: source.title }),
                ],
                spacing: { after: 80 },
              }),
            );
          }
        });
      }
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = customFilename || getExportFilename(persona, 'docx');
  downloadBlob(blob, filename);
}
