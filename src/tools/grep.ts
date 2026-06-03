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
		try {
			// 1. Build the regex:
			const flags = input.case_insensitive ? "gi" : "g";
			const regex = new RegExp(input.pattern as string, flags);
			//
			// 2. Determine search root:
			const searchPath = resolve((input.path as string) ?? ".");
			//
			// 3. Collect all files recursively (skip node_modules, .git, dist):
			//    collectFiles() is defined below — reads the directory, skips
			//    ["node_modules", ".git", "dist"], recurses into subdirs, returns
			//    a flat list of file paths.
			let files = await collectFiles(searchPath);
			//
			// 4. Filter by glob if provided:
			//    if (input.glob) filter files where path ends with the extension
			//    (simple: if glob is "*.ts", check file.endsWith(".ts"))
			if (input.glob) {
				const ext = (input.glob as string).replace(/^\*/, "");
				files = files.filter((f) => f.endsWith(ext));
			}
			//
			// 5. Search each file:
			const matches: string[] = [];
			for (const file of files) {
				const content = await readFile(file, "utf-8").catch(() => null);
				if (!content) continue;
				const lines = content.split("\n");
				lines.forEach((line, i) => {
					if (regex.test(line)) {
						regex.lastIndex = 0; // reset for "g" flag
						matches.push(`${relative(searchPath, file)}:${i + 1}: ${line.trim()}`);
					}
				});
				if (matches.length >= MAX_RESULTS) break;
			}
			//
			// 6. Return results:
			if (matches.length === 0) return okResult("No matches found");
			const truncated = matches.length >= MAX_RESULTS ? `\n[limited to ${MAX_RESULTS} results]` : "";
			return okResult(matches.join("\n") + truncated);
			// void input;
			// void readFile;
			// void readdir;
			// void stat;
			// void join;
			// void resolve;
			// void relative;
			// void MAX_RESULTS;
			// void okResult;
			// void errorResult;
			// throw new Error("Grep tool not implemented yet — see comments above");
		} catch (err) {
			return errorResult(err);
		}
	},
};

async function collectFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir);
    const files: string[] = [];

    for (const entry of entries) {
        if (["node_modules", ".git", "dist"].includes(entry)) {
            continue;
        }

        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
            files.push(...await collectFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}
