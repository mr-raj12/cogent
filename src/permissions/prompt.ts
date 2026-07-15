// Interactive permission prompt: shows what the model wants to do and asks
// before it happens. Remembers "always" answers for the rest of the session.

import type readline from "node:readline";
import chalk from "chalk";
import type { CanUseTool, PermissionDecision } from "./types.js";

// A short, readable description of what a tool call is about to do.
function describe(name: string, input: Record<string, unknown>): string {
	if (name === "Bash") return String(input.command ?? "");
	if (name === "Write") return `write ${String(input.file_path ?? "")}`;
	if (name === "Edit") return `edit ${String(input.file_path ?? "")}`;
	return JSON.stringify(input);
}

export function createPromptPermission(rl: readline.Interface): CanUseTool {
	const alwaysAllowed = new Set<string>();

	return async (name, input): Promise<PermissionDecision> => {
		if (alwaysAllowed.has(name)) return { behavior: "allow" };

		console.log(`\n${chalk.yellow.bold("  ⏵ Permission needed")}  ${chalk.bold(name)}`);
		console.log(`  ${chalk.gray(describe(name, input))}`);
		console.log(`  ${chalk.gray("[y] yes   [a] yes, and don't ask again for this tool   [n] no (default)")}`);

		const answer = await new Promise<string>((resolve) => {
			rl.question(chalk.yellow("  > "), resolve);
		});

		const choice = answer.trim().toLowerCase();

		if (choice === "a" || choice === "always") {
			alwaysAllowed.add(name);
			console.log(chalk.gray(`  Allowing ${name} for the rest of this session.\n`));
			return { behavior: "allow" };
		}

		if (choice === "y" || choice === "yes") {
			console.log();
			return { behavior: "allow" };
		}

		console.log(chalk.red("  Denied.\n"));
		return {
			behavior: "deny",
			message: `The user denied permission to run ${name}. Do not retry this call; ask what they'd like instead.`,
		};
	};
}
