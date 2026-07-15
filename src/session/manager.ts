// Session lifecycle: create, resume, and append messages to a session.

import { randomUUID } from "node:crypto";
import type { Message } from "../types.js";
import { appendEntry, loadSession } from "./store.js";
import type { Session } from "./types.js";

export async function createSession(model: string, provider: string): Promise<Session> {
	const id = randomUUID();
	const created_at = new Date().toISOString();
	const session: Session = { id, created_at, model, provider, messages: [] };

	await appendEntry(id, { type: "session_info", id, created_at, model, provider });

	return session;
}

export async function resumeSession(sessionId: string): Promise<Session | null> {
	return loadSession(sessionId);
}

export async function saveMessage(sessionId: string, message: Message): Promise<void> {
	await appendEntry(sessionId, { type: "message", message });
}

export async function saveMessages(sessionId: string, messages: Message[]): Promise<void> {
	for (const message of messages) await saveMessage(sessionId, message);
}

// Compaction is recorded but does not rewrite the log: the JSONL stays the
// complete transcript, and the summary is a marker of what the model saw.
export async function saveCompaction(sessionId: string, summary: string, originalCount: number): Promise<void> {
	await appendEntry(sessionId, { type: "compaction", summary, original_count: originalCount });
}
