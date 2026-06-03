// PHASE 2 — Implement the Edit tool
// Replaces an exact string within a file — precision editing without rewriting the whole file

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

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
			// TODO PHASE 2 — Implement exact-string replacement
			//
			// 1. Resolve and read the file:
			const filePath = resolve(input.file_path as string);
			const content = await readFile(filePath, "utf-8");
			//
			// 2. Check old_string exists:
			if (!content.includes(input.old_string as string))
				return errorResult(`old_string not found in file`);
			//
			// 3. Check old_string is unique (count occurrences):
			const count = content.split(input.old_string as string).length - 1;
			if (count > 1) return errorResult(`old_string appears ${count} times — must be unique`);
			//
			// 4. Replace and write:
			const newContent = content.replace(input.old_string as string, input.new_string as string);
			await writeFile(filePath, newContent, "utf-8");
			//
			// 5. Return success:
			return okResult(`Edited ${filePath}`);
			// void input;
			// void readFile;
			// void writeFile;
			// void resolve;
			// void okResult;
			// void errorResult;
			// throw new Error("Edit tool not implemented yet — see comments above");
		} catch (err) {
			return errorResult(err);
		}
	},
};
