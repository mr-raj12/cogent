// Core shared types — used everywhere, never needs changing

export type Role = "user" | "assistant" | "system";

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
	role: Role;
	content: ContentBlock[] | string;
}

export interface Usage {
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens?: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";

// Helper: get plain text from a message's content
export function getTextContent(content: ContentBlock[] | string): string {
	if (typeof content === "string") return content;
	return content
		.filter((b): b is TextBlock => b.type === "text")
		.map((b) => b.text)
		.join("");
}
