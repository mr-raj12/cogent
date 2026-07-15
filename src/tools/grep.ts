// Grep tool — searches file contents with a regex and reports matching lines.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

const MAX_RESULTS = 100;

export const grepTool: Tool = {
	name: "Grep",
	description:
		"Search for a pattern (regex) in file contents. " +
		"Returns matching lines with file path and line number. " +
		"Searches recursively in directories. Skips node_modules and .git.",
	readOnly: true,
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
		try {
			const flags = input.case_insensitive ? "gi" : "g";
			const regex = new RegExp(input.pattern as string, flags);
			const searchPath = resolve((input.path as string) ?? ".");

			let files = await collectFiles(searchPath);

			if (input.glob) {
				const ext = (input.glob as string).replace(/^\*/, "");
				files = files.filter((f) => f.endsWith(ext));
			}

			const matches: string[] = [];
			for (const file of files) {
				const content = await readFile(file, "utf-8").catch(() => null);
				if (!content) continue;
				const lines = content.split("\n");
				lines.forEach((line, i) => {
					if (regex.test(line)) {
						regex.lastIndex = 0; // reset for the global flag
						matches.push(`${relative(searchPath, file)}:${i + 1}: ${line.trim()}`);
					}
				});
				if (matches.length >= MAX_RESULTS) break;
			}

			if (matches.length === 0) return okResult("No matches found");
			const truncated = matches.length >= MAX_RESULTS ? `\n[limited to ${MAX_RESULTS} results]` : "";
			return okResult(matches.join("\n") + truncated);
		} catch (err) {
			return errorResult(err);
		}
	},
};

async function collectFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir);
	const files: string[] = [];

	for (const entry of entries) {
		if (["node_modules", ".git", "dist"].includes(entry)) continue;

		const fullPath = join(dir, entry);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			files.push(...(await collectFiles(fullPath)));
		} else {
			files.push(fullPath);
		}
	}

	return files;
}
