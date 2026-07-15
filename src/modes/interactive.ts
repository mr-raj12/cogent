// Interactive REPL: read a line, run the agent, stream the response, repeat.
// Slash commands are handled here; everything else goes to the model.

import readline from "node:readline";
import chalk from "chalk";
import { runAgent } from "../agent/loop.js";
import type { AgentOptions } from "../agent/types.js";
import { createPromptPermission } from "../permissions/prompt.js";
import { allowAll } from "../permissions/types.js";
import { createSession, saveCompaction, saveMessage, saveMessages } from "../session/manager.js";
import type { Session } from "../session/types.js";
import type { Message } from "../types.js";
import { type CommandResult, isCommand, type ReplState, runCommand } from "./commands.js";

export interface InteractiveOptions {
	providerName: string;
	model: string;
	system: string;
	contextLimit?: number;
	yolo: boolean; // skip permission prompts
	session?: Session; // resumed session, if any
}

export async function runInteractiveMode(options: InteractiveOptions): Promise<void> {
	const session = options.session ?? (await createSession(options.model, options.providerName));

	const state: ReplState = {
		providerName: options.providerName,
		model: options.model,
		messages: [...(options.session?.messages ?? [])],
		sessionId: session.id,
		contextLimit: options.contextLimit,
		yolo: options.yolo,
	};

	// terminal: true gives arrow-key history, line editing, and SIGINT.
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
		historySize: 200,
	});

	const canUseTool = options.yolo ? allowAll : createPromptPermission(rl);

	printBanner(state, options.session);

	let interrupted = false;
	rl.on("SIGINT", () => {
		if (interrupted) {
			rl.close();
			process.exit(0);
		}
		interrupted = true;
		console.log(chalk.gray("\n(Ctrl+C again to exit, or /exit)"));
		rl.prompt();
	});

	while (true) {
		const userInput = await ask(rl);
		if (userInput === null) break; // stream closed
		interrupted = false;

		const trimmed = userInput.trim();
		if (!trimmed) continue;

		if (isCommand(trimmed)) {
			const result: CommandResult = await runCommand(trimmed, state).catch((err) => {
				console.log(chalk.red(`Command failed: ${err instanceof Error ? err.message : String(err)}`));
				return {};
			});
			if (result.exit) break;
			continue;
		}

		const userMessage: Message = { role: "user", content: trimmed };
		state.messages.push(userMessage);
		await saveMessage(state.sessionId, userMessage);

		console.log(chalk.bold.blue("\nAssistant: "));

		const agentOptions: AgentOptions = {
			providerName: state.providerName,
			model: state.model,
			system: options.system,
			messages: state.messages,
			contextLimit: state.contextLimit,
			canUseTool,
		};

		try {
			await runTurn(agentOptions, state);
		} catch (err) {
			console.log(chalk.red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
			// Drop the message that failed so the history stays consistent.
			state.messages.pop();
		}

		console.log();
	}

	rl.close();
	console.log(chalk.gray(`\nSession saved: ${state.sessionId}`));
	console.log(chalk.gray(`Resume it with: cogent --session ${state.sessionId}\n`));
}

// Run one agent turn, rendering events and persisting whatever it produces.
async function runTurn(agentOptions: AgentOptions, state: ReplState): Promise<void> {
	for await (const event of runAgent(agentOptions)) {
		switch (event.type) {
			case "text_delta":
				process.stdout.write(event.delta);
				break;

			case "tool_start":
				console.log(chalk.cyan(`\n  [${event.name}] ${JSON.stringify(event.input)}`));
				break;

			case "tool_end": {
				const color = event.isError ? chalk.red : chalk.gray;
				console.log(color(`  → ${event.result.slice(0, 200)}`));
				break;
			}

			case "tool_denied":
				console.log(chalk.red(`  → skipped ${event.name}`));
				break;

			case "compacted":
				console.log(chalk.magenta(`\n  [auto-compacted: ${event.before} → ${event.after} messages]`));
				await saveCompaction(state.sessionId, event.summary, event.before);
				break;

			case "agent_end":
				// Adopt the loop's history so an auto-compaction survives into the
				// next turn, and log only what this run added.
				state.messages.length = 0;
				state.messages.push(...event.messages);
				await saveMessages(state.sessionId, event.newMessages);
				break;
		}
	}
}

function ask(rl: readline.Interface): Promise<string | null> {
	return new Promise((resolve) => {
		// Resolving on close covers Ctrl+D / a closed stream. The listener has to
		// come off once the line lands, or every prompt leaks one and Node starts
		// warning about a listener leak.
		const onClose = () => resolve(null);
		rl.once("close", onClose);
		rl.question(chalk.bold.green("\nYou: "), (answer) => {
			rl.removeListener("close", onClose);
			resolve(answer);
		});
	});
}

function printBanner(state: ReplState, resumed?: Session): void {
	console.log(chalk.bold("cogent") + chalk.gray(` — ${state.providerName}/${state.model}`));

	if (resumed) {
		console.log(chalk.gray(`Resumed session ${resumed.id.slice(0, 8)} — ${state.messages.length} messages restored.`));
	}
	if (state.yolo) {
		console.log(chalk.yellow("Permission prompts are off (--yolo). Tools run unattended."));
	}

	console.log(chalk.gray("/help for commands, /exit to quit.\n"));
}
