// PHASE 2 — Implement the Ls tool
// List files and directories at a given path

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

export const lsTool: Tool = {
	name: "Ls",
	description: "List files and directories at a path. Shows type (file/dir), size, and name.",
	inputSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Directory path to list (default: current directory)",
			},
		},
		required: [],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		// TODO PHASE 2 — Implement directory listing
		//
		// 1. Resolve the path:
		//    const dirPath = resolve((input.path as string) ?? ".");
		//
		// 2. Read directory entries:
		//    const entries = await readdir(dirPath, { withFileTypes: true });
		//
		// 3. For each entry, get its size (for files):
		//    const lines = await Promise.all(entries.map(async (entry) => {
		//      if (entry.isDirectory()) return `[dir]  ${entry.name}/`;
		//      const s = await stat(join(dirPath, entry.name));
		//      const size = s.size < 1024 ? `${s.size}B` : `${(s.size / 1024).toFixed(1)}KB`;
		//      return `[file] ${entry.name} (${size})`;
		//    }));
		//
		// 4. Sort: dirs first, then files, alphabetically:
		//    lines.sort((a, b) => {
		//      const aDir = a.startsWith("[dir]");
		//      const bDir = b.startsWith("[dir]");
		//      if (aDir !== bDir) return aDir ? -1 : 1;
		//      return a.localeCompare(b);
		//    });
		//
		// 5. Return:
		//    return okResult(`${dirPath}:\n${lines.join("\n")}`);

		void input;
		void readdir;
		void stat;
		void join;
		void resolve;
		void okResult;
		void errorResult;
		throw new Error("Ls tool not implemented yet — see comments above");
	},
};
