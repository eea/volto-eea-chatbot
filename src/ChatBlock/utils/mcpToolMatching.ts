import type { ToolSnapshot } from '@eeacms/volto-eea-chatbot/ChatBlock/types/interfaces';

/**
 * Common keyword aliases for known tools.
 */
const TOOL_KEYWORD_ALIASES: Record<string, string[]> = {
  data: ['data', 'dataset', 'datasets', 'dataconnector', 'tabular', 'sql'],
  data_connector: ['data', 'dataset', 'datasets', 'dataconnector', 'tabular'],
  eea_data: ['data', 'dataset', 'datasets', 'eea data'],
  python: ['python', 'code', 'script', 'programming', 'calculate', 'numpy', 'pandas'],
  code_interpreter: ['python', 'code', 'script', 'programming', 'calculate'],
  image: ['image', 'images', 'picture', 'photo', 'illustration', 'draw', 'generate image'],
  image_generation: ['image', 'images', 'picture', 'photo', 'illustration', 'draw', 'generate image'],
  myopenbrain: ['myopenbrain', 'openbrain'],
  sql: ['sql', 'query', 'database', 'postgres'],
};

/**
 * Detailed match metadata for an inactive MCP tool suggestion.
 */
export interface SuggestedMcpToolMatch extends ToolSnapshot {
  tool: ToolSnapshot;
  matchedText: string;
  matchIndex: number;
  matchLength: number;
}

/**
 * Extracts normalized search keywords from a tool definition.
 */
export function getToolKeywords(tool: ToolSnapshot): string[] {
  const keywords = new Set<string>();

  const addKeywordsFromText = (text?: string | null) => {
    if (!text) return;
    const clean = text.toLowerCase().trim();
    if (!clean) return;

    // Full name/display name
    keywords.add(clean);

    // Split by underscores, hyphens, spaces
    clean
      .split(/[\s_\-]+/)
      .filter((word) => word.length >= 3)
      .forEach((word) => keywords.add(word));
  };

  addKeywordsFromText(tool.name);
  addKeywordsFromText(tool.display_name);

  // Check aliases based on tool name or display name
  const lowerName = (tool.name || '').toLowerCase();
  const lowerDisplay = (tool.display_name || '').toLowerCase();

  Object.entries(TOOL_KEYWORD_ALIASES).forEach(([aliasKey, aliasList]) => {
    if (lowerName.includes(aliasKey) || lowerDisplay.includes(aliasKey)) {
      aliasList.forEach((kw) => keywords.add(kw));
    }
  });

  return Array.from(keywords);
}

/**
 * Detects if a tool is the primary internal search tool.
 */
export function isPrimarySearchTool(tool: ToolSnapshot): boolean {
  return (
    tool.in_code_tool_id === 'SearchTool' ||
    tool.name === 'internal_search' ||
    tool.id === 1
  );
}

/**
 * Finds an inactive MCP tool that matches keywords in the user's input,
 * returning the matched tool and the exact location of the trigger keyword.
 */
export function findSuggestedMcpTool(
  input: string,
  availableTools: ToolSnapshot[] = [],
  selectedToolIds: number[] = [],
  dismissedToolIds: Set<number> = new Set(),
): SuggestedMcpToolMatch | null {
  if (!input || !input.trim() || !Array.isArray(availableTools)) {
    return null;
  }

  const normalizedInput = input.toLowerCase();

  // Filter to candidate tools that are:
  // 1. Not already enabled in selectedToolIds
  // 2. Not the primary internal search tool (which is already active)
  // 3. Not dismissed by the user during this prompt
  // 4. Enabled and chat_selectable
  const candidateTools = availableTools.filter((tool) => {
    if (selectedToolIds.includes(tool.id)) return false;
    if (isPrimarySearchTool(tool)) return false;
    if (dismissedToolIds.has(tool.id)) return false;
    if (tool.enabled === false) return false;
    if (tool.chat_selectable === false) return false;
    return true;
  });

  if (candidateTools.length === 0) {
    return null;
  }

  // Check if any candidate tool matches a keyword in the input
  let bestMatch: SuggestedMcpToolMatch | null = null;
  let longestMatchLength = 0;

  for (const tool of candidateTools) {
    const toolTag = `@${(tool.display_name || tool.name).toLowerCase()}`;
    // If user already typed the @tag, don't propose it
    if (normalizedInput.includes(toolTag)) {
      continue;
    }

    const keywords = getToolKeywords(tool);
    for (const kw of keywords) {
      // Word boundary match: keyword must appear as a distinct word or token
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s.,!?;:()"])${escaped}([\\s.,!?;:()"]|$)`, 'gi');

      let execResult: RegExpExecArray | null;
      let lastMatch: { index: number; text: string; length: number } | null = null;

      while ((execResult = regex.exec(normalizedInput)) !== null) {
        const leadingDelimiter = execResult[1] || '';
        const matchIndex = execResult.index + leadingDelimiter.length;
        const matchedText = input.slice(matchIndex, matchIndex + kw.length);
        lastMatch = {
          index: matchIndex,
          text: matchedText,
          length: kw.length,
        };
      }

      if (lastMatch) {
        if (kw.length > longestMatchLength) {
          longestMatchLength = kw.length;
          bestMatch = {
            ...tool,
            tool,
            matchedText: lastMatch.text,
            matchIndex: lastMatch.index,
            matchLength: lastMatch.length,
          };
        }
      }
    }
  }

  return bestMatch;
}
