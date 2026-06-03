// PHASE 5 — Session manager
// Creates new sessions, resumes existing ones, and persists messages

import { randomUUID } from "node:crypto";
import type { Session } from "./types.js";
import type { Message } from "../types.js";
import { appendEntry, loadSession } from "./store.js";

export async function createSession(model: string, provider: string): Promise<Session> {
	// TODO PHASE 5 — Create a new session and write its info entry
	//
	// const id = randomUUID();
	// const created_at = new Date().toISOString();
	// const session: Session = { id, created_at, model, provider, messages: [] };
	//
	// await appendEntry(id, { type: "session_info", id, created_at, model, provider });
	//
	// return session;

	void model;
	void provider;
	void randomUUID;
	void appendEntry;
	throw new Error("createSession not implemented yet");
}

export async function resumeSession(sessionId: string): Promise<Session | null> {
	// TODO PHASE 5 — Load a session from disk
	//
	// return loadSession(sessionId);

	void sessionId;
	void loadSession;
	return null;
}

export async function saveMessage(sessionId: string, message: Message): Promise<void> {
	// TODO PHASE 5 — Persist a message to the session file
	//
	// await appendEntry(sessionId, { type: "message", message });

	void sessionId;
	void message;
	void appendEntry;
}
