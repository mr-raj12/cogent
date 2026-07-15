// Read tool — returns a file's contents with 1-indexed line numbers prefixed.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

export const readTool: Tool = {
	name: "Read",
	description:
		"Read the contents of a file. Returns content with line numbers prefixed (e.g. '1\\tline content'). " +
		"Use offset and limit to read a specific range of lines.",
	readOnly: true,
	inputSchema: {
		type: "object",
		properties: {
			file_path: {
				type: "string",
				description: "Path to the file to read (absolute or relative to cwd)",
			},
			offset: {
				type: "number",
				description: "Line number to start reading from (1-indexed, optional)",
			},
			limit: {
				type: "number",
				description: "Max number of lines to read (optional, default: all)",
			},
		},
		required: ["file_path"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const filePath = resolve(input.file_path as string);
			if (!existsSync(filePath)) return errorResult(`File not found: ${filePath}`);

			const raw = await readFile(filePath, "utf-8");
			const lines = raw.split("\n");
			// Drop the empty trailing element a final newline produces.
			if (lines.at(-1) === "") lines.pop();

			const start = Math.max(0, ((input.offset as number) ?? 1) - 1);
			const slice = lines.slice(start);
			const limited = input.limit ? slice.slice(0, input.limit as number) : slice;

			// Prefix each line with its absolute line number, e.g. "11\tconst x = 1;".
			const numbered = limited.map((line, i) => `${start + i + 1}\t${line}`).join("\n");

			return okResult(numbered);
		} catch (err) {
			return errorResult(err);
		}
	},
};
