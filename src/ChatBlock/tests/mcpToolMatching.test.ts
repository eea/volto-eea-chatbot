import {
  getToolKeywords,
  isPrimarySearchTool,
  findSuggestedMcpTool,
} from '../utils/mcpToolMatching';
import type { ToolSnapshot } from '../types/interfaces';

describe('mcpToolMatching', () => {
  const mockTools: ToolSnapshot[] = [
    {
      id: 1,
      name: 'internal_search',
      display_name: 'Internal Search',
      in_code_tool_id: 'SearchTool',
      enabled: true,
      chat_selectable: true,
    },
    {
      id: 10,
      name: 'data_connector',
      display_name: 'EEA Data Connector',
      description: 'Query EEA tabular datasets',
      mcp_server_id: 1,
      enabled: true,
      chat_selectable: true,
    },
    {
      id: 20,
      name: 'myopenbrain',
      display_name: 'MyOpenBrain',
      description: 'Save notes and resources',
      mcp_server_id: 2,
      enabled: true,
      chat_selectable: true,
    },
    {
      id: 30,
      name: 'python',
      display_name: 'Python Interpreter',
      in_code_tool_id: 'PythonTool',
      enabled: true,
      chat_selectable: true,
    },
  ];

  describe('isPrimarySearchTool', () => {
    it('identifies primary search tool by id, name, or in_code_tool_id', () => {
      expect(isPrimarySearchTool(mockTools[0])).toBe(true);
      expect(isPrimarySearchTool({ id: 1, name: 'other', display_name: 'Other' })).toBe(true);
      expect(isPrimarySearchTool({ id: 5, name: 'internal_search', display_name: 'Search' })).toBe(true);
      expect(isPrimarySearchTool(mockTools[1])).toBe(false);
    });
  });

  describe('getToolKeywords', () => {
    it('extracts keywords and domain aliases from tool definitions', () => {
      const keywords = getToolKeywords(mockTools[1]);
      expect(keywords).toContain('data');
      expect(keywords).toContain('connector');
      expect(keywords).toContain('dataset');
    });

    it('extracts keywords for openbrain tool', () => {
      const keywords = getToolKeywords(mockTools[2]);
      expect(keywords).toContain('myopenbrain');
      expect(keywords).toContain('openbrain');
    });
  });

  describe('findSuggestedMcpTool', () => {
    it('returns null for empty input or empty tools', () => {
      expect(findSuggestedMcpTool('', mockTools, [1])).toBeNull();
      expect(findSuggestedMcpTool('hello', [], [1])).toBeNull();
    });

    it('never suggests primary search tool even if keyword matches search', () => {
      const match = findSuggestedMcpTool('search documents', mockTools, []);
      expect(match).toBeNull();
    });

    it('suggests MCP tool when keyword is mentioned in user input and returns match metadata', () => {
      const match = findSuggestedMcpTool(
        'Please show me the emissions data for 2024',
        mockTools,
        [1],
      );
      expect(match).not.toBeNull();
      expect(match?.id).toBe(10);
      expect(match?.matchedText).toBe('data');
      expect(match?.matchIndex).toBe(29);
      expect(match?.matchLength).toBe(4);
    });

    it('suggests MyOpenBrain when user types myopenbrain', () => {
      const match = findSuggestedMcpTool(
        'I want to research about MCP, find resources and save it in myopenbrain',
        mockTools,
        [1],
      );
      expect(match).not.toBeNull();
      expect(match?.id).toBe(20);
    });

    it('does not suggest a tool that is already in selectedToolIds', () => {
      const match = findSuggestedMcpTool(
        'Please show me the emissions data',
        mockTools,
        [1, 10], // 10 is already enabled
      );
      expect(match).toBeNull();
    });

    it('does not suggest a tool if user already typed @ToolName', () => {
      const match = findSuggestedMcpTool(
        'Save this to myopenbrain @MyOpenBrain',
        mockTools,
        [1],
      );
      expect(match).toBeNull();
    });

    it('ignores dismissed tool IDs', () => {
      const dismissed = new Set([10]);
      const match = findSuggestedMcpTool(
        'Give me data on emissions',
        mockTools,
        [1],
        dismissed,
      );
      expect(match).toBeNull();
    });

    it('suggests Python when user asks to calculate or write python script', () => {
      const match = findSuggestedMcpTool(
        'Can you write a python script for this?',
        mockTools,
        [1],
      );
      expect(match).not.toBeNull();
      expect(match?.id).toBe(30);
    });

    it('matches the latest/trailing occurrence of a keyword', () => {
      const match = findSuggestedMcpTool(
        'Save notes and openbrain resources in openbrain',
        mockTools,
        [1],
      );
      expect(match).not.toBeNull();
      expect(match?.id).toBe(20);
      // Index of second "openbrain" at the end
      expect(match?.matchIndex).toBe(38);
      expect(match?.matchLength).toBe(9);
    });
  });
});
