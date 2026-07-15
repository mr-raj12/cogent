// Slash commands for the TUI. Same surface as the readline REPL, but results are
// pushed into the transcript instead of written straight to stdout.

import { compactMessages, estimateTokens, getContextLimit } from "../agent/compaction.js";
import { getModelInfo, MODELS } from "../providers/index.js";
import { saveCompaction } from "../session/manager.js";
import { listSessionSummaries } from "../session/store.js";
import { ALL_TOOLS } from "../tools/index.js";
import type { Message } from "../types.js";
import type { Tone } from "./types.js";

export interface CommandContext {
	providerName: string;
	model: string;
	messages: Message[];
	sessionId: string;
	contextLimit?: number;
	setModel: (id: string) => void;
	setProviderName: (name: string) => void;
	setMessages: (messages: Message[]) => void;
	notice: (text: string, tone?: Tone) => void;
}

export interface CommandResult {
	exit?: boolean;
	clearScreen?: boolean;
}

// A short, readable description of what a tool call is about to do — used by both
// the permission dialog and the transcript.
export function describeTool(name: string, input: Record<string, unknown>): string {
	if (name === "Bash") return String(input.command ?? "");
	if (name === "Write") return String(input.file_path ?? "");
	if (name === "Edit") return String(input.file_path ?? "");
	if (name === "Read") return String(input.file_path ?? "");
	if (name === "Grep") return String(input.pattern ?? "");
	if (name === "Find") return String(input.pattern ?? "");
	if (name === "Ls") return String(input.path ?? ".");
	return JSON.stringify(input).slice(0, 80);
}

export async function runTuiCommand(line: string, ctx: CommandContext): Promise<CommandResult> {
	const [name, ...rest] = line.trim().slice(1).split(/\s+/);
	const arg = rest.join(" ").trim();

	switch (name) {
		case "exit":
		case "quit":
			return { exit: true };

		case "help":
			ctx.notice(HELP);
			return {};

		case "model":
			switchModel(arg, ctx);
			return {};

		case "compact":
			await compact(ctx);
			return {};

		case "clear":
			ctx.setMessages([]);
			ctx.notice("Context cleared. The session log on disk is untouched.", "success");
			return { clearScreen: true };

		case "tools":
			ctx.notice(
				`Tools\n${ALL_TOOLS.map((t) => `  ${t.name.padEnd(7)} ${t.readOnly ? "[read-only]" : "[asks permission]"}`).join("\n")}`,
			);
			return {};

		case "context":
			showContext(ctx);
			return {};

		case "sessions":
			await showSessions(ctx);
			return {};

		case "session":
			ctx.notice(`Session ${ctx.sessionId}\nResume with: cogent --session ${ctx.sessionId}`);
			return {};

		default:
			ctx.notice(`Unknown command: /${name} — try /help`, "error");
			return {};
	}
}

const HELP = `Commands
  /model [id]   Show models, or switch to one — keeps the conversation
  /compact      Summarize the history now and free up context
  /context      Show token usage against the context window
  /clear        Drop the in-memory history, keep the session file
  /tools        List the tools the model can call
  /sessions     List saved sessions
  /session      Show this session's id and resume command
  /exit         Quit`;

function switchModel(arg: string, ctx: CommandContext): void {
	if (!arg) {
		const list = MODELS.map(
			(m) => `  ${m.provider.padEnd(10)} ${m.id.padEnd(26)}${m.id === ctx.model ? " ← current" : ""}`,
		).join("\n");
		ctx.notice(`Available models — /model <id> to switch\n${list}`);
		return;
	}

	const info = getModelInfo(arg);
	if (!info) {
		ctx.notice(`Unknown model: ${arg} — run /model to list them`, "error");
		return;
	}

	const previous = ctx.model;
	ctx.setModel(info.id);
	ctx.setProviderName(info.provider);
	ctx.notice(
		`Switched ${previous} → ${info.id} (${info.provider}) — conversation kept, ${ctx.messages.length} messages carried over.`,
		"success",
	);

	const limit = getContextLimit(info.id, ctx.contextLimit);
	const used = estimateTokens(ctx.messages);
	if (limit && used > limit * 0.75) {
		ctx.notice(`Heads up: ~${used} tokens is close to ${info.name}'s ${limit} window. /compact may help.`, "warn");
	}
}

async function compact(ctx: CommandContext): Promise<void> {
	if (ctx.messages.length === 0) {
		ctx.notice("Nothing to compact — the history is empty.");
		return;
	}

	const before = estimateTokens(ctx.messages);
	const beforeCount = ctx.messages.length;

	const result = await compactMessages(ctx.messages, ctx.providerName, ctx.model);
	if (!result.compacted) {
		ctx.notice("History is already short enough to leave alone.");
		return;
	}

	ctx.setMessages(result.messages);
	await saveCompaction(ctx.sessionId, result.summary, result.originalCount);

	const after = estimateTokens(result.messages);
	const saved = Math.max(0, Math.round((1 - after / before) * 100));
	ctx.notice(
		`Compacted: ${beforeCount} → ${result.messages.length} messages, ~${before} → ~${after} tokens (${saved}% smaller)\n\n${result.summary}`,
		"success",
	);
}

function showContext(ctx: CommandContext): void {
	const used = estimateTokens(ctx.messages);
	const limit = getContextLimit(ctx.model, ctx.contextLimit);

	if (!limit) {
		ctx.notice(`~${used} tokens across ${ctx.messages.length} messages (window unknown).`);
		return;
	}

	const pct = Math.round((used / limit) * 100);
	const filled = Math.min(20, Math.round((used / limit) * 20));
	const bar = "█".repeat(filled) + "░".repeat(20 - filled);
	ctx.notice(
		`${bar} ${pct}%\n~${used} / ${limit} tokens · ${ctx.messages.length} messages · auto-compacts at 75%`,
		pct > 75 ? "warn" : "info",
	);
}

async function showSessions(ctx: CommandContext): Promise<void> {
	const sessions = await listSessionSummaries();
	if (sessions.length === 0) {
		ctx.notice("No saved sessions yet.");
		return;
	}

	const list = sessions
		.slice(0, 10)
		.map(
			(s) =>
				`  ${s.id.slice(0, 8)}  ${new Date(s.created_at).toLocaleString()}  ${s.messageCount} msgs\n    ${s.firstPrompt}`,
		)
		.join("\n");
	ctx.notice(`Saved sessions — cogent --session <id> to resume\n${list}`);
}
