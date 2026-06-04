// Session storage as JSONL — one JSON entry per line, appended as the
// conversation grows. Sessions live under .pi-clone/sessions/<id>.jsonl.

import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session, SessionEntry } from "./types.js";

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
	await ensureSessionDir();
	const line = `${JSON.stringify(entry)}\n`;
	await appendFile(getSessionPath(sessionId), line, "utf-8");
}

export async function loadSession(sessionId: string): Promise<Session | null> {
	if (!existsSync(getSessionPath(sessionId))) return null;

	const raw = await readFile(getSessionPath(sessionId), "utf-8");
	const entries: SessionEntry[] = raw
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as SessionEntry);

	const infoEntry = entries.find((e) => e.type === "session_info");
	if (infoEntry?.type !== "session_info") return null;

	const messages = entries
		.filter((e): e is Extract<SessionEntry, { type: "message" }> => e.type === "message")
		.map((e) => e.message);

	return {
		id: infoEntry.id,
		created_at: infoEntry.created_at,
		model: infoEntry.model,
		provider: infoEntry.provider,
		messages,
	};
}

export async function listSessions(): Promise<string[]> {
	await ensureSessionDir();
	const files = await readdir(getSessionDir());
	return files.filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(".jsonl", ""));
}
