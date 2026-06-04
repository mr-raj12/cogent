import { parseArgs, printHelp, printVersion } from "./cli/args.js";
import { loadSettings } from "./config/settings.js";
import { buildSystemPrompt } from "./config/system-prompt.js";
import { runInteractiveMode } from "./modes/interactive.js";
import { runPrintMode } from "./modes/print.js";
import { getDefaultModel, MODELS } from "./providers/index.js";
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

	const settings = await loadSettings();

	const providerName = args.provider ?? settings.provider ?? process.env.COGENT_PROVIDER ?? "gemini";
	const model = args.model ?? settings.model ?? process.env.COGENT_MODEL ?? getDefaultModel(providerName);

	const messages: Message[] = [];

	if (args.message) {
		messages.push({ role: "user", content: args.message });
	}

	// When stdin is piped (not a TTY), treat it as the first message.
	if (!process.stdin.isTTY && !args.message) {
		const stdinData = await readStdin();
		if (stdinData.trim()) {
			messages.push({ role: "user", content: stdinData.trim() });
		}
	}

	const system = await buildSystemPrompt(settings.systemPromptExtra);
	const agentOptions = { providerName, model, system, messages, maxTurns: 20 };

	if (args.print || messages.length > 0) {
		await runPrintMode(agentOptions);
	} else {
		await runInteractiveMode({ providerName, model });
	}
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
