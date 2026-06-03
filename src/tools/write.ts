// Write tool — creates or overwrites a file, making parent directories as needed.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

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
			const filePath = resolve(input.file_path as string);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, input.content as string, "utf-8");
			return okResult(`File written: ${filePath}`);
		} catch (err) {
			return errorResult(err);
		}
	},
};
