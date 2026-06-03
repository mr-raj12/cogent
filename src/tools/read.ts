// PHASE 2 — Implement the Read tool
// Reads a file and returns its content with line numbers

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

export const readTool: Tool = {
  name: "Read",
  description:
    "Read the contents of a file. Returns content with line numbers prefixed (e.g. '1\\tline content'). " +
    "Use offset and limit to read a specific range of lines.",
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
      // TODO PHASE 2 — Implement file reading
      //
      // 1. Get file_path from input:
      const filePath = resolve(input.file_path as string);
      //
      // 2. Check file exists:
      if (!existsSync(filePath))
        return errorResult(`File not found: ${filePath}`);
      //
      // 3. Read it:
      const raw = await readFile(filePath, "utf-8");
      //
      // 4. Split into lines (be careful: trailing newline adds an empty line):
      const lines = raw.split("\n");
      if (lines.at(-1) === "") lines.pop(); //  Look at the last element (lines.at(-1)).
      //    hello\nworld\n -> ["hello", "world", ""]
      //    hello\nworld -> ["hello", "world"]
      //
      // 5. Apply offset (1-indexed, so subtract 1):
      const start = Math.max(0, ((input.offset as number) ?? 1) - 1);
      const slice = lines.slice(start);
      //
      // 6. Apply limit:
      const limited = input.limit ? slice.slice(0, input.limit as number) : slice;
      //
      // const limited = [
      // 	"const x = 1;",
      // 	"const y = 2;",
      // 	"console.log(x + y);"
      // ];
      // const start = 10;
      // 7. Add line numbers:
      const numbered = limited
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join("\n");
      //
      // [
      //   "11\tconst x = 1;",
      //   "12\tconst y = 2;",
      //   "13\tconsole.log(x + y);"
      // ]
      // "11\tconst x = 1;\n12\tconst y = 2;\n13\tconsole.log(x + y);"
      //
      // 8. Return:
      return okResult(numbered);
      // void input;
      // void readFile;
      // void existsSync;
      // void resolve;
      // throw new Error("Read tool not implemented yet — see comments above");
    } catch (err) {
      return errorResult(err);
    }
  },
};
