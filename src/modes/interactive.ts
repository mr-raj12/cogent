// Interactive REPL: read a line, run the agent, stream the response, repeat.

import readline from "node:readline";
import chalk from "chalk";
import { runAgent } from "../agent/loop.js";
import type { AgentOptions } from "../agent/types.js";
import { buildSystemPrompt } from "../config/system-prompt.js";
import type { Message } from "../types.js";

export async function runInteractiveMode(options: Pick<AgentOptions, "providerName" | "model">): Promise<void> {
	const system = await buildSystemPrompt();
	const messages: Message[] = [];

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
	const prompt = () =>
		new Promise<string>((resolve) => {
			process.stdout.write(chalk.bold.green("\nYou: "));
			rl.once("line", resolve);
		});

	console.log(chalk.bold("cogent") + chalk.gray(` — ${options.providerName}/${options.model}`));
	console.log(chalk.gray("Type your message. Ctrl+C to exit.\n"));

	while (true) {
		let userInput: string;
		try {
			userInput = await prompt();
		} catch {
			break;
		}

		if (!userInput.trim()) continue;
		if (userInput.trim() === "/exit" || userInput.trim() === "/quit") break;

		messages.push({ role: "user", content: userInput });

		console.log(chalk.bold.blue("\nAssistant: "));
		const agentOptions: AgentOptions = { ...options, system, messages };
		const newMessages: Message[] = [];

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
				case "agent_end":
					newMessages.push(...event.messages.slice(messages.length));
					break;
			}
		}

		messages.push(...newMessages);
		console.log();
	}

	rl.close();
	console.log(chalk.gray("\nGoodbye!"));
}
