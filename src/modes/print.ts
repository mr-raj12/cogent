// Print mode: stream agent events straight to stdout for non-interactive use.

import chalk from "chalk";
import { runAgent } from "../agent/loop.js";
import type { AgentOptions } from "../agent/types.js";

export async function runPrintMode(options: AgentOptions): Promise<void> {
	for await (const event of runAgent(options)) {
		switch (event.type) {
			case "text_delta":
				process.stdout.write(event.delta);
				break;

			case "tool_start": {
				const inputStr = JSON.stringify(event.input, null, 2);
				console.log(chalk.cyan(`\n[Tool: ${event.name}]`));
				console.log(chalk.gray(inputStr));
				break;
			}

			case "tool_end": {
				const color = event.isError ? chalk.red : chalk.green;
				console.log(color(`[Result: ${event.name}]`));
				console.log(chalk.gray(event.result.slice(0, 500)));
				break;
			}

			case "turn_end": {
				const { input_tokens, output_tokens } = event.usage;
				console.log(chalk.gray(`\n[tokens: in=${input_tokens} out=${output_tokens}]`));
				break;
			}

			case "agent_end":
				console.log();
				break;
		}
	}
}
