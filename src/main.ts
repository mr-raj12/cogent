import { parseArgs, printHelp, printVersion } from "./cli/args.js";
import { loadSettings } from "./config/settings.js";
import { buildSystemPrompt } from "./config/system-prompt.js";
import { runInteractiveMode } from "./modes/interactive.js";
import { runPrintMode } from "./modes/print.js";
import { allowAll } from "./permissions/types.js";
import { getDefaultModel, getModelInfo, MODELS } from "./providers/index.js";
import { createSession, resumeSession, saveMessage } from "./session/manager.js";
import { listSessionSummaries } from "./session/store.js";
import type { Session } from "./session/types.js";
import type { Message } from "./types.js";

export async function main(argv: string[]): Promise<void> {
	const args = parseArgs(argv);

	if (args.help) {
		printHelp();
		return;
	}
	if (args.version) {
		printVersion();
		return;
	}
	if (args.listModels) {
		console.log("\nAvailable models:\n");
		for (const m of MODELS) {
			console.log(`  ${m.provider.padEnd(8)} ${m.id.padEnd(42)} ${m.name}`);
		}
		console.log();
		return;
	}
	if (args.listSessions) {
		await printSessions();
		return;
	}

	const settings = await loadSettings();

	// A resumed session remembers its own provider/model, but an explicit flag
	// still wins — that's how you resume a conversation onto a different model.
	let resumed: Session | undefined;
	if (args.session) {
		const found = await resumeSession(args.session);
		if (!found) throw new Error(`No such session: ${args.session}  (try --list-sessions)`);
		resumed = found;
	}

	const providerName =
		args.provider ?? resumed?.provider ?? settings.provider ?? process.env.COGENT_PROVIDER ?? "gemini";
	const model =
		args.model ?? resumed?.model ?? settings.model ?? process.env.COGENT_MODEL ?? getDefaultModel(providerName);

	if (args.model && !getModelInfo(args.model)) {
		throw new Error(`Unknown model: ${args.model}  (try --list-models)`);
	}

	const messages: Message[] = [...(resumed?.messages ?? [])];

	// A message can arrive as an argument or piped through stdin.
	let opening = args.message?.trim();
	if (!opening && !process.stdin.isTTY) {
		opening = (await readStdin()).trim() || undefined;
	}
	if (opening) {
		messages.push({ role: "user", content: opening });
	}

	const system = await buildSystemPrompt(settings.systemPromptExtra);

	// Print mode is non-interactive, so there is nobody to answer a permission
	// prompt: tools run unattended there by definition.
	if (args.print || opening) {
		const session = resumed ?? (await createSession(model, providerName));
		const userMessage = messages.at(-1);
		if (userMessage) await saveMessage(session.id, userMessage);

		await runPrintMode({
			providerName,
			model,
			system,
			messages,
			maxTurns: 20,
			contextLimit: args.contextLimit,
			canUseTool: allowAll,
			sessionId: session.id,
		});
		return;
	}

	const interactiveOptions = {
		providerName,
		model,
		system,
		contextLimit: args.contextLimit,
		yolo: args.yolo,
		session: resumed,
	};

	// The TUI needs a real terminal; --classic is the plain readline REPL.
	if (args.classic || !process.stdout.isTTY) {
		await runInteractiveMode(interactiveOptions);
		return;
	}

	const { runTui } = await import("./tui/run.js");
	await runTui(interactiveOptions);
}

async function printSessions(): Promise<void> {
	const sessions = await listSessionSummaries();
	if (sessions.length === 0) {
		console.log("\nNo saved sessions yet.\n");
		return;
	}

	console.log("\nSaved sessions (newest first):\n");
	for (const s of sessions) {
		const when = new Date(s.created_at).toLocaleString();
		console.log(`  ${s.id}`);
		console.log(`    ${when} · ${s.provider}/${s.model} · ${s.messageCount} messages`);
		console.log(`    ${s.firstPrompt}\n`);
	}
	console.log("Resume with: cogent --session <id>\n");
}

async function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
	});
}
