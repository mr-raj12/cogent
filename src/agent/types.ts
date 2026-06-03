import type { Message, Usage, StopReason } from "../types.js";

// Every event the agent loop emits — UI and session storage listen to these
export type AgentEvent =
	| { type: "agent_start" }
	| { type: "text_delta"; delta: string }
	| { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_end"; id: string; name: string; result: string; isError: boolean }
	| { type: "turn_end"; stop_reason: StopReason; usage: Usage }
	| { type: "agent_end"; messages: Message[] }; // final messages incl. all tool results

// What you pass to runAgent()
export interface AgentOptions {
	providerName: string; // "gemini" | "groq"
	model: string;
	system: string;
	messages: Message[]; // existing history — new messages appended during the run
	maxTurns?: number; // safety cap, default 20
}
