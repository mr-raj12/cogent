import type { CanUseTool } from "../permissions/types.js";
import type { Message, StopReason, Usage } from "../types.js";

// Every event the agent loop emits — UI and session storage listen to these
export type AgentEvent =
	| { type: "agent_start" }
	| { type: "text_delta"; delta: string }
	| { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_end"; id: string; name: string; result: string; isError: boolean }
	| { type: "tool_denied"; id: string; name: string; reason: string }
	| { type: "compacted"; summary: string; before: number; after: number }
	| { type: "turn_end"; stop_reason: StopReason; usage: Usage }
	// `messages` is the full history the loop ended with (possibly compacted);
	// `newMessages` is only what this run produced, for append-only session logs.
	| { type: "agent_end"; messages: Message[]; newMessages: Message[] };

// What you pass to runAgent()
export interface AgentOptions {
	providerName: string; // "gemini" | "groq"
	model: string;
	system: string;
	messages: Message[]; // existing history — new messages appended during the run
	maxTurns?: number; // safety cap, default 20
	contextLimit?: number; // override the model's context window (demo/testing)
	canUseTool?: CanUseTool; // permission gate; defaults to allowing everything
}
