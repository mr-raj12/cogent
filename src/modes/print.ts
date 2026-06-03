// PHASE 4 — Implement print mode
// Streams agent output to stdout — the simplest way to run the agent

import chalk from "chalk";
import { runAgent } from "../agent/loop.js";
import type { AgentOptions } from "../agent/types.js";

export async function runPrintMode(options: AgentOptions): Promise<void> {
	// TODO PHASE 4 — Stream agent events to the terminal
	//
	// This is the simplest mode: iterate AgentEvents and print to stdout.
	//
	// for await (const event of runAgent(options)) {
	//   switch (event.type) {
	//     case "text_delta":
	//       process.stdout.write(event.delta);
	//       break;
	//
	//     case "tool_start":
	//       // Show what tool is being called
	//       const inputStr = JSON.stringify(event.input, null, 2);
	//       console.log(chalk.cyan(`\n[Tool: ${event.name}]`));
	//       console.log(chalk.gray(inputStr));
	//       break;
	//
	//     case "tool_end":
	//       // Show tool result
	//       const color = event.isError ? chalk.red : chalk.green;
	//       console.log(color(`[Result: ${event.name}]`));
	//       console.log(chalk.gray(event.result.slice(0, 500)));  // truncate long results
	//       break;
	//
	//     case "turn_end":
	//       // Show token usage
	//       const { input_tokens, output_tokens } = event.usage;
	//       console.log(chalk.gray(`\n[tokens: in=${input_tokens} out=${output_tokens}]`));
	//       break;
	//
	//     case "agent_end":
	//       console.log(); // final newline
	//       break;
	//   }
	// }

	void options;
	void runAgent;
	void chalk;
	throw new Error("Print mode not implemented yet — see comments above");
}
