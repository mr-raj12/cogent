// Session storage as JSONL — one JSON entry per line, appended as the
// conversation grows. Sessions live under .cogent/sessions/<id>.jsonl.

import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTextContent } from "../types.js";
import type { Session, SessionEntry } from "./types.js";

export function getSessionDir(): string {
	return join(process.cwd(), ".cogent", "sessions");
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

export interface SessionSummary {
	id: string;
	created_at: string;
	model: string;
	provider: string;
	messageCount: number;
	firstPrompt: string;
}

// Load every session's header plus its opening prompt, newest first — enough to
// pick one to resume without reading whole transcripts into memory.
export async function listSessionSummaries(): Promise<SessionSummary[]> {
	const ids = await listSessions();
	const summaries: SessionSummary[] = [];

	for (const id of ids) {
		const session = await loadSession(id).catch(() => null);
		if (!session) continue;

		const first = session.messages.find((m) => m.role === "user");
		const firstText = first ? getTextContent(first.content) : "";

		summaries.push({
			id: session.id,
			created_at: session.created_at,
			model: session.model,
			provider: session.provider,
			messageCount: session.messages.length,
			firstPrompt: firstText.replace(/\s+/g, " ").slice(0, 60) || "(no prompt)",
		});
	}

	return summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
