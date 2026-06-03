import type { Tool } from "./types.js";
import type { ToolDefinition } from "../providers/types.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { bashTool } from "./bash.js";
import { grepTool } from "./grep.js";
import { findTool } from "./find.js";
import { lsTool } from "./ls.js";

export * from "./types.js";

// All tools registered here — add new tools to this list
export const ALL_TOOLS: Tool[] = [readTool, writeTool, editTool, bashTool, grepTool, findTool, lsTool];

// Convert our Tool format to the JSON Schema format the LLM expects
export function getToolDefinitions(): ToolDefinition[] {
	return ALL_TOOLS.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: t.inputSchema,
	}));
}

// Look up a tool by name — used in the agent loop when LLM calls a tool
export function getTool(name: string): Tool | undefined {
	return ALL_TOOLS.find((t) => t.name === name);
}
