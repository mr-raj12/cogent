// PHASE 6 — Build the system prompt
// Combines base instructions + tool list + project context files

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_TOOLS } from "../tools/index.js";

// Files automatically loaded as project context (in priority order)
const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md", ".context", ".pi-clone/context.md"];

export async function buildSystemPrompt(extra?: string): Promise<string> {
	// TODO PHASE 6 — Build the full system prompt
	//
	// The system prompt has 4 parts:
	//
	// 1. Base instructions (hardcode this string):
	//    const base = `You are pi-clone, an autonomous coding assistant.
	//    You are running in: ${process.cwd()}
	//    Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
	//
	//    You have access to tools to read files, write files, run shell commands, and search code.
	//    Use tools proactively to understand the codebase before making changes.
	//    Always read a file before editing it. Verify your changes work.
	//    Be concise. No sycophantic openers. No unnecessary explanation.`;
	//
	// 2. Tool list (already built — just format it):
	//    const toolsList = ALL_TOOLS.map(t => `- ${t.name}: ${t.description}`).join("\n");
	//    const toolsSection = `\nAvailable tools:\n${toolsList}`;
	//
	// 3. Project context files (load whatever exists):
	//    let contextSection = "";
	//    for (const filename of CONTEXT_FILES) {
	//      const filepath = join(process.cwd(), filename);
	//      if (existsSync(filepath)) {
	//        const content = await readFile(filepath, "utf-8");
	//        contextSection += `\n\n--- ${filename} ---\n${content}`;
	//      }
	//    }
	//
	// 4. Extra prompt from settings (optional):
	//    const extraSection = extra ? `\n\n${extra}` : "";
	//
	// return base + toolsSection + contextSection + extraSection;

	void readFile;
	void existsSync;
	void join;
	void resolve;
	void ALL_TOOLS;
	void CONTEXT_FILES;
	void extra;
	throw new Error("buildSystemPrompt not implemented yet — see comments above");
}
