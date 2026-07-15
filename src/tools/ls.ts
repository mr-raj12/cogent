// Ls tool — lists files and directories at a path.

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

export const lsTool: Tool = {
	name: "Ls",
	description: "List files and directories at a path. Shows type (file/dir), size, and name.",
	readOnly: true,
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
		try {
			const dirPath = resolve((input.path as string) ?? ".");
			const entries = await readdir(dirPath, { withFileTypes: true });

			const lines = await Promise.all(
				entries.map(async (entry) => {
					if (entry.isDirectory()) return `[dir]  ${entry.name}/`;
					const s = await stat(join(dirPath, entry.name));
					const size = s.size < 1024 ? `${s.size}B` : `${(s.size / 1024).toFixed(1)}KB`;
					return `[file] ${entry.name} (${size})`;
				}),
			);

			// Directories first, then files, alphabetically.
			lines.sort((a, b) => {
				const aDir = a.startsWith("[dir]");
				const bDir = b.startsWith("[dir]");
				if (aDir !== bDir) return aDir ? -1 : 1;
				return a.localeCompare(b);
			});

			return okResult(`${dirPath}:\n${lines.join("\n")}`);
		} catch (err) {
			return errorResult(err);
		}
	},
};
