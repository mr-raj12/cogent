// Edit tool — replaces an exact, unique string in a file.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

export const editTool: Tool = {
	name: "Edit",
	description:
		"Replace an exact string in a file with new content. " +
		"old_string must appear EXACTLY once in the file (same whitespace, same indentation). " +
		"Use Read first to see the exact content before editing.",
	inputSchema: {
		type: "object",
		properties: {
			file_path: {
				type: "string",
				description: "Path to the file to edit",
			},
			old_string: {
				type: "string",
				description: "The exact text to find and replace (must be unique in the file)",
			},
			new_string: {
				type: "string",
				description: "The text to replace it with",
			},
		},
		required: ["file_path", "old_string", "new_string"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const filePath = resolve(input.file_path as string);
			const content = await readFile(filePath, "utf-8");

			if (!content.includes(input.old_string as string)) {
				return errorResult(`old_string not found in file`);
			}

			const count = content.split(input.old_string as string).length - 1;
			if (count > 1) return errorResult(`old_string appears ${count} times — must be unique`);

			const newContent = content.replace(input.old_string as string, input.new_string as string);
			await writeFile(filePath, newContent, "utf-8");

			return okResult(`Edited ${filePath}`);
		} catch (err) {
			return errorResult(err);
		}
	},
};
