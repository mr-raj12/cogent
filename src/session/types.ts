import type { Message } from "../types.js";

// One line in the JSONL file
export type SessionEntry =
	| { type: "session_info"; id: string; created_at: string; model: string; provider: string }
	| { type: "message"; message: Message }
	| { type: "compaction"; summary: string; original_count: number };

// A fully loaded session
export interface Session {
	id: string;
	created_at: string;
	model: string;
	provider: string;
	messages: Message[];
}
