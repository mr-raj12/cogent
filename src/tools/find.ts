// PHASE 2 — Implement the Find tool
// Search for files by name pattern (glob-style)

import { readdir, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "build"]);
const MAX_RESULTS = 200;

export const findTool: Tool = {
	name: "Find",
	description:
		"Find files by name pattern. Supports wildcards: * (any chars), ? (one char). " +
		"Searches recursively. Skips node_modules, .git, dist.",
	inputSchema: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "File name pattern to match (e.g. '*.ts', 'config.*', 'README*')",
			},
			path: {
				type: "string",
				description: "Directory to search in (default: current directory)",
			},
		},
		required: ["pattern"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		// TODO PHASE 2 — Implement file name search
		//
		// 1. Convert the glob pattern to a regex:
		//    const escaped = (input.pattern as string)
		//      .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape special chars
		//      .replace(/\*/g, ".*")                    // * → .*
		//      .replace(/\?/g, ".");                    // ? → .
		//    const regex = new RegExp(`^${escaped}$`, "i");
		//
		// 2. Determine search root:
		//    const searchRoot = resolve((input.path as string) ?? ".");
		//
		// 3. Walk directories recursively:
		//    async function walk(dir: string): Promise<string[]> {
		//      const entries = await readdir(dir, { withFileTypes: true });
		//      const results: string[] = [];
		//      for (const entry of entries) {
		//        if (entry.isDirectory()) {
		//          if (SKIP_DIRS.has(entry.name)) continue;
		//          results.push(...await walk(join(dir, entry.name)));
		//        } else if (regex.test(entry.name)) {
		//          results.push(join(dir, entry.name));
		//        }
		//      }
		//      return results;
		//    }
		//
		// 4. Run and format results:
		//    const files = (await walk(searchRoot)).slice(0, MAX_RESULTS);
		//    if (files.length === 0) return okResult("No files found");
		//    return okResult(files.map(f => relative(searchRoot, f)).join("\n"));

		void input;
		void readdir;
		void stat;
		void join;
		void resolve;
		void relative;
		void SKIP_DIRS;
		void MAX_RESULTS;
		void okResult;
		void errorResult;
		throw new Error("Find tool not implemented yet — see comments above");
	},
};
