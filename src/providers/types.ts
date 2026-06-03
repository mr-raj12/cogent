import type { Message, Usage, StopReason } from "../types.js";

// Every event the provider can stream back to the agent loop
export type StreamEvent =
	| { type: "text_delta"; delta: string }
	| { type: "tool_use_start"; id: string; name: string }
	| { type: "tool_use_input_delta"; id: string; delta: string }
	| { type: "tool_use_end"; id: string }
	| { type: "message_end"; stop_reason: StopReason; usage: Usage };

// How we describe a tool to the LLM (JSON Schema format)
export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>; // JSON Schema object
}

// What you pass to provider.complete()
export interface CompletionOptions {
	model: string;
	system: string;
	messages: Message[];
	tools: ToolDefinition[];
	max_tokens: number;
	temperature?: number;
}

// Every provider implements this interface
export interface Provider {
	name: string;
	complete(options: CompletionOptions): AsyncGenerator<StreamEvent>;
}

// Info about a model — used for listing and validation
export interface ModelInfo {
	id: string;
	name: string;
	provider: string;
	contextWindow: number;
	maxOutputTokens: number;
}
