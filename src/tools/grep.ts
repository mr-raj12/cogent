// PHASE 2 — Implement the Grep tool
// Search file contents using a regex pattern

import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

const MAX_RESULTS = 100;

export const grepTool: Tool = {
	name: "Grep",
	description:
		"Search for a pattern (regex) in file contents. " +
		"Returns matching lines with file path and line number. " +
		"Searches recursively in directories. Skips node_modules and .git.",
	inputSchema: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "Regular expression pattern to search for",
			},
			path: {
				type: "string",
				description: "File or directory to search in (default: current directory)",
			},
			glob: {
				type: "string",
				description: "File extension filter like '*.ts' or '*.py' (optional)",
			},
			case_insensitive: {
				type: "boolean",
				description: "Case-insensitive search (default: false)",
			},
		},
		required: ["pattern"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		// TODO PHASE 2 — Implement regex file search
		//
		// 1. Build the regex:
		//    const flags = input.case_insensitive ? "gi" : "g";
		//    const regex = new RegExp(input.pattern as string, flags);
		//
		// 2. Determine search root:
		//    const searchPath = resolve((input.path as string) ?? ".");
		//
		// 3. Collect all files recursively (skip node_modules, .git, dist):
		//    Write a helper async function collectFiles(dir: string): Promise<string[]>
		//    that reads the directory, skips ["node_modules", ".git", "dist"],
		//    recurses into subdirectories, and returns a flat list of file paths.
		//
		// 4. Filter by glob if provided:
		//    if (input.glob) filter files where path ends with the extension
		//    (simple: if glob is "*.ts", check file.endsWith(".ts"))
		//
		// 5. Search each file:
		//    const matches: string[] = [];
		//    for (const file of files) {
		//      const content = await readFile(file, "utf-8").catch(() => null);
		//      if (!content) continue;
		//      const lines = content.split("\n");
		//      lines.forEach((line, i) => {
		//        if (regex.test(line)) {
		//          regex.lastIndex = 0; // reset for "g" flag
		//          matches.push(`${relative(searchPath, file)}:${i + 1}: ${line.trim()}`);
		//        }
		//      });
		//      if (matches.length >= MAX_RESULTS) break;
		//    }
		//
		// 6. Return results:
		//    if (matches.length === 0) return okResult("No matches found");
		//    const truncated = matches.length >= MAX_RESULTS ? `\n[limited to ${MAX_RESULTS} results]` : "";
		//    return okResult(matches.join("\n") + truncated);

		void input;
		void readFile;
		void readdir;
		void stat;
		void join;
		void resolve;
		void relative;
		void MAX_RESULTS;
		void okResult;
		void errorResult;
		throw new Error("Grep tool not implemented yet — see comments above");
	},
};
