// Slash commands for the REPL. Each one gets the live session state and may
// mutate it (switch model, clear history) or just print something.

import chalk from "chalk";
import { compactMessages, estimateTokens, getContextLimit } from "../agent/compaction.js";
import { getModelInfo, MODELS } from "../providers/index.js";
import { saveCompaction } from "../session/manager.js";
import { listSessionSummaries } from "../session/store.js";
import { ALL_TOOLS } from "../tools/index.js";
import type { Message } from "../types.js";

// Mutable state a command is allowed to touch.
export interface ReplState {
	providerName: string;
	model: string;
	messages: Message[];
	sessionId: string;
	contextLimit?: number;
	yolo: boolean;
}

export interface CommandResult {
	exit?: boolean;
}

// True if the line should be handled as a command rather than sent to the model.
export function isCommand(line: string): boolean {
	return line.trim().startsWith("/");
}

export async function runCommand(line: string, state: ReplState): Promise<CommandResult> {
	const [name, ...rest] = line.trim().slice(1).split(/\s+/);
	const arg = rest.join(" ").trim();

	switch (name) {
		case "exit":
		case "quit":
			return { exit: true };

		case "help":
			printHelp();
			return {};

		case "model":
			await switchModel(arg, state);
			return {};

		case "compact":
			await compact(state);
			return {};

		case "clear":
			state.messages.length = 0;
			console.log(chalk.gray("Context cleared. The session log on disk is untouched."));
			return {};

		case "tools":
			printTools();
			return {};

		case "context":
			printContext(state);
			return {};

		case "sessions":
			await printSessions();
			return {};

		case "session":
			console.log(chalk.gray(`Session ${state.sessionId} — resume with: cogent --session ${state.sessionId}`));
			return {};

		default:
			console.log(chalk.red(`Unknown command: /${name}`) + chalk.gray("  (try /help)"));
			return {};
	}
}

function printHelp(): void {
	console.log(`
${chalk.bold("Commands")}
  /model [id]     Show models, or switch to one — keeps the conversation
  /compact        Summarize the history now and free up context
  /context        Show token usage against the context window
  /clear          Drop the in-memory history, keep the session file
  /tools          List the tools the model can call
  /sessions       List saved sessions
  /session        Show this session's id and resume command
  /help           Show this help
  /exit           Quit
`);
}

async function switchModel(arg: string, state: ReplState): Promise<void> {
	if (!arg) {
		console.log(`\n${chalk.bold("Available models")}  ${chalk.gray("— /model <id> to switch")}\n`);
		for (const m of MODELS) {
			const current = m.id === state.model ? chalk.green(" ← current") : "";
			console.log(`  ${chalk.gray(m.provider.padEnd(8))} ${m.id.padEnd(32)} ${chalk.gray(m.name)}${current}`);
		}
		console.log();
		return;
	}

	const info = getModelInfo(arg);
	if (!info) {
		console.log(chalk.red(`Unknown model: ${arg}`) + chalk.gray("  (run /model to list them)"));
		return;
	}

	const previous = state.model;
	state.model = info.id;
	state.providerName = info.provider;

	console.log(
		chalk.gray(`Switched ${previous} → `) +
			chalk.bold.green(info.id) +
			chalk.gray(` (${info.provider}) — conversation kept, ${state.messages.length} messages carried over.`),
	);

	// Providers differ in context window; warn if the history no longer fits.
	const limit = getContextLimit(info.id, state.contextLimit);
	const used = estimateTokens(state.messages);
	if (limit && used > limit * 0.75) {
		console.log(
			chalk.yellow(`Heads up: ~${used} tokens is close to ${info.name}'s ${limit} window. /compact may help.`),
		);
	}
}

async function compact(state: ReplState): Promise<void> {
	if (state.messages.length === 0) {
		console.log(chalk.gray("Nothing to compact — the history is empty."));
		return;
	}

	const before = estimateTokens(state.messages);
	const beforeCount = state.messages.length;
	process.stdout.write(chalk.gray("Compacting… "));

	const result = await compactMessages(state.messages, state.providerName, state.model);
	if (!result.compacted) {
		console.log(chalk.gray("history is already short enough to leave alone."));
		return;
	}

	state.messages.length = 0;
	state.messages.push(...result.messages);
	await saveCompaction(state.sessionId, result.summary, result.originalCount);

	const after = estimateTokens(state.messages);
	const saved = Math.max(0, Math.round((1 - after / before) * 100));
	console.log(
		chalk.green("done.") +
			chalk.gray(
				` ${beforeCount} messages → ${state.messages.length}, ~${before} → ~${after} tokens (${saved}% smaller)`,
			),
	);
	console.log(chalk.gray(`\nSummary: ${result.summary}\n`));
}

function printTools(): void {
	console.log(`\n${chalk.bold("Tools")}\n`);
	for (const t of ALL_TOOLS) {
		const tag = t.readOnly ? chalk.gray("[read-only]") : chalk.yellow("[asks permission]");
		console.log(`  ${chalk.bold(t.name.padEnd(7))} ${tag}`);
		console.log(`  ${chalk.gray(t.description.split(".")[0])}.\n`);
	}
}

function printContext(state: ReplState): void {
	const used = estimateTokens(state.messages);
	const limit = getContextLimit(state.model, state.contextLimit);

	if (!limit) {
		console.log(chalk.gray(`~${used} tokens across ${state.messages.length} messages (window unknown).`));
		return;
	}

	const pct = Math.round((used / limit) * 100);
	const filled = Math.min(20, Math.round((used / limit) * 20));
	const bar = "█".repeat(filled) + "░".repeat(20 - filled);
	const color = pct > 75 ? chalk.red : pct > 50 ? chalk.yellow : chalk.green;

	console.log(
		`\n  ${color(bar)} ${pct}%  ${chalk.gray(`~${used} / ${limit} tokens · ${state.messages.length} messages`)}`,
	);
	console.log(chalk.gray(`  Auto-compacts at 75%.${state.contextLimit ? " (limit overridden for this run)" : ""}\n`));
}

async function printSessions(): Promise<void> {
	const sessions = await listSessionSummaries();
	if (sessions.length === 0) {
		console.log(chalk.gray("No saved sessions yet."));
		return;
	}

	console.log(`\n${chalk.bold("Saved sessions")}  ${chalk.gray("— cogent --session <id> to resume")}\n`);
	for (const s of sessions.slice(0, 10)) {
		const when = new Date(s.created_at).toLocaleString();
		console.log(
			`  ${chalk.bold(s.id.slice(0, 8))} ${chalk.gray(when.padEnd(22))} ${chalk.gray(`${s.messageCount} msgs`)}`,
		);
		console.log(`  ${chalk.gray(s.firstPrompt)}\n`);
	}
}
