// PHASE 2 — Implement the Write tool
// Creates or completely overwrites a file

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

export const writeTool: Tool = {
	name: "Write",
	description:
		"Write content to a file, creating it if it doesn't exist and overwriting it if it does. " +
		"Creates parent directories automatically.",
	inputSchema: {
		type: "object",
		properties: {
			file_path: {
				type: "string",
				description: "Path to the file to write",
			},
			content: {
				type: "string",
				description: "The full content to write to the file",
			},
		},
		required: ["file_path", "content"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			// TODO PHASE 2 — Implement file writing
			//
			// 1. Resolve path:
			const filePath = resolve(input.file_path as string);
			//
			// 2. Create parent directories (won't fail if they exist):
			await mkdir(dirname(filePath), { recursive: true });
			//
			// 3. Write the file:
			await writeFile(filePath, input.content as string, "utf-8");
			//
			// 4. Return success:
			return okResult(`File written: ${filePath}`);
			//
			// Wrap in try/catch and return errorResult(err) if anything throws.
			// void input;
			// void writeFile;
			// void mkdir;
			// void dirname;
			// void resolve;
			// void okResult;
			// void errorResult;
			// throw new Error("Write tool not implemented yet — see comments above");
		} catch (err) {
			return errorResult(err);
		}
	},
};
