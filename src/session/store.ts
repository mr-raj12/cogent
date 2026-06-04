// PHASE 5 — Implement session storage
// JSONL files: one JSON object per line, appended as the conversation grows

import { appendFile, readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SessionEntry, Session } from "./types.js";

// Where all sessions live: ~/.pi-clone/sessions/<id>.jsonl
export function getSessionDir(): string {
	return join(process.cwd(), ".pi-clone", "sessions");
}

export function getSessionPath(sessionId: string): string {
	return join(getSessionDir(), `${sessionId}.jsonl`);
}

export async function ensureSessionDir(): Promise<void> {
	await mkdir(getSessionDir(), { recursive: true });
}

export async function appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
	// PHASE 5 — Append a single JSON line to the session file
	//
	await ensureSessionDir();
	const line = JSON.stringify(entry) + "\n";
	await appendFile(getSessionPath(sessionId), line, "utf-8");

	// void sessionId;
	// void entry;
	// void appendFile;
	// void ensureSessionDir;
	// throw new Error("appendEntry not implemented yet");
}

export async function loadSession(sessionId: string): Promise<Session | null> {
	// PHASE 5 — Read a JSONL file and reconstruct a Session
	//
	// 1. Check if the file exists:
	   if (!existsSync(getSessionPath(sessionId))) return null;
	//
	// 2. Read the file and parse each line:
	   const raw = await readFile(getSessionPath(sessionId), "utf-8");
	   const entries: SessionEntry[] = raw
	     .split("\n")
	     .filter(line => line.trim())
	     .map(line => JSON.parse(line) as SessionEntry);
	//
	// 3. Build the session:
	   const infoEntry = entries.find(e => e.type === "session_info");
	   if (!infoEntry || infoEntry.type !== "session_info") return null;
	//
	   const messages = entries
	     .filter((e): e is Extract<SessionEntry, { type: "message" }> => e.type === "message")
	     .map(e => e.message);
	//
	   return { id: infoEntry.id, created_at: infoEntry.created_at, model: infoEntry.model, provider: infoEntry.provider, messages };

	// void sessionId;
	// void readFile;
	// void existsSync;
	// void getSessionPath;
	// return null;
}

export async function listSessions(): Promise<string[]> {
	// PHASE 5 — List all session IDs
	//
	await ensureSessionDir();
	const files = await readdir(getSessionDir());
	return files.filter(f => f.endsWith(".jsonl")).map(f => f.replace(".jsonl", ""));

	// void existsSync;
	// return [];
}
