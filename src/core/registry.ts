import { IMAGE_TOOLS } from './tools/imageTools.ts';
import { PDF_TOOLS } from './tools/pdfTools.ts';
import { UTILITY_TOOLS } from './tools/utilityTools.ts';
import type { ToolCategory, ToolDefinition } from './types.ts';

export const ALL_TOOLS: ToolDefinition[] = [
  ...PDF_TOOLS,
  ...IMAGE_TOOLS,
  ...UTILITY_TOOLS,
];

const TOOL_MAP = new Map<string, ToolDefinition>();
for (const tool of ALL_TOOLS) {
  TOOL_MAP.set(tool.id, tool);
  TOOL_MAP.set(tool.mcpName, tool);
}

export function getTool(idOrMcpName: string): ToolDefinition | undefined {
  return TOOL_MAP.get(idOrMcpName.trim());
}

export function listTools(category?: ToolCategory): ToolDefinition[] {
  if (!category) return ALL_TOOLS;
  return ALL_TOOLS.filter((tool) => tool.category === category);
}
