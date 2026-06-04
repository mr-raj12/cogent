import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ALL_TOOLS } from "../tools/index.js";

// Project context files, loaded in priority order if present.
const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md", ".context", ".pi-clone/context.md"];

// Assemble the system prompt from base instructions, the tool list, any project
// context files, and an optional extra string from settings.
export async function buildSystemPrompt(extra?: string): Promise<string> {
	const base = `You are pi-clone, an autonomous coding assistant.
You are running in: ${process.cwd()}
Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

You have access to tools to read files, write files, run shell commands, and search code.
Use tools proactively to understand the codebase before making changes.
Always read a file before editing it. Verify your changes work.
Be concise. No sycophantic openers. No unnecessary explanation.`;

	const toolsList = ALL_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");
	const toolsSection = `\nAvailable tools:\n${toolsList}`;

	let contextSection = "";
	for (const filename of CONTEXT_FILES) {
		const filepath = join(process.cwd(), filename);
		if (existsSync(filepath)) {
			const content = await readFile(filepath, "utf-8");
			contextSection += `\n\n--- ${filename} ---\n${content}`;
		}
	}

	const extraSection = extra ? `\n\n${extra}` : "";

	return base + toolsSection + contextSection + extraSection;
}
