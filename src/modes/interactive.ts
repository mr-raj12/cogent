// PHASE 8 — Implement interactive mode
// readline-based REPL: user types, agent responds, repeat

import readline from "node:readline";
import chalk from "chalk";
import { runAgent } from "../agent/loop.js";
import { buildSystemPrompt } from "../config/system-prompt.js";
import type { Message } from "../types.js";
import type { AgentOptions } from "../agent/types.js";

export async function runInteractiveMode(options: Pick<AgentOptions, "providerName" | "model">): Promise<void> {
	//  PHASE 8 — Implement the interactive chat loop
	//
	// 1. Build the system prompt:
	   const system = await buildSystemPrompt();
	   const messages: Message[] = [];
	//
	// 2. Create a readline interface:
	   const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
	   const prompt = () =>
       new Promise<string>((resolve) => {
		process.stdout.write(chalk.bold.green("\nYou: "));
        //  rl.question(chalk.bold.green("\nYou: "), resolve);
		rl.once("line", resolve);
       });
	//
	// 3. Print welcome message:
	   console.log(chalk.bold("pi-clone") + chalk.gray(` — ${options.providerName}/${options.model}`));
	   console.log(chalk.gray("Type your message. Ctrl+C to exit.\n"));
	//
	// 4. Main loop:
	   while (true) {
	     let userInput: string;
	     try { userInput = await prompt(); }
	     catch { break; } // Ctrl+C
	//
	     if (!userInput.trim()) continue;
	//
	//      // Handle built-in commands
	     if (userInput.trim() === "/exit" || userInput.trim() === "/quit") break;
	//
	//      // Add user message
	     messages.push({ role: "user", content: userInput });
	//
	//      // Run agent and collect new messages
	     console.log(chalk.bold.blue("\nAssistant: "));
	     const agentOptions: AgentOptions = { ...options, system, messages };
	     const newMessages: Message[] = [];
	//
	     for await (const event of runAgent(agentOptions)) {
	       switch (event.type) {
	         case "text_delta":
	           process.stdout.write(event.delta);
	           break;
	         case "tool_start":
	           console.log(chalk.cyan(`\n  [${event.name}] ${JSON.stringify(event.input)}`));
	           break;
	         case "tool_end":
	           const color = event.isError ? chalk.red : chalk.gray;
	           console.log(color(`  → ${event.result.slice(0, 200)}`));
	           break;
	         case "agent_end":
	           newMessages.push(...event.messages.slice(messages.length));
	           break;
	       }
	     }
	//
	//      // Update message history with what the agent produced
	     messages.push(...newMessages);
	     console.log();
	   }
	//
	   rl.close();
	   console.log(chalk.gray("\nGoodbye!"));

	// void options;
	// void readline;
	// void chalk;
	// void runAgent;
	// void buildSystemPrompt;
	// throw new Error("Interactive mode not implemented yet — see comments above");
}
