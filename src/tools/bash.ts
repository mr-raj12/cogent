// PHASE 2 — Implement the Bash tool
// Executes a shell command and returns stdout + stderr

import { spawn } from "node:child_process";
import type { Tool } from "./types.js";
import { okResult, errorResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_OUTPUT_CHARS = 20_000; // truncate very long outputs

export const bashTool: Tool = {
	name: "Bash",
	description:
		"Execute a shell command and return its output (stdout + stderr combined). " +
		"Runs in the current working directory. Timeout: 30 seconds. " +
		"Avoid interactive commands or long-running processes.",
	inputSchema: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The shell command to execute",
			},
			timeout_ms: {
				type: "number",
				description: "Timeout in milliseconds (default: 30000)",
			},
		},
		required: ["command"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		// TODO PHASE 2 — Implement shell execution
		//
		// Use Node's child_process.spawn to run the command.
		// On Windows: shell is "cmd.exe", args ["/c", command]
		// On Unix: shell is "/bin/sh", args ["-c", command]
		//
		// 1. Determine shell:
		//    const isWindows = process.platform === "win32";
		//    const shell = isWindows ? "cmd.exe" : "/bin/sh";
		//    const shellArgs = isWindows ? ["/c", input.command as string] : ["-c", input.command as string];
		//
		// 2. Spawn the process:
		//    const child = spawn(shell, shellArgs, { cwd: process.cwd() });
		//
		// 3. Collect output — wrap in a Promise:
		//    return new Promise((resolve) => {
		//      let output = "";
		//      child.stdout.on("data", (d: Buffer) => { output += d.toString(); });
		//      child.stderr.on("data", (d: Buffer) => { output += d.toString(); });
		//
		//      const timer = setTimeout(() => {
		//        child.kill();
		//        resolve(errorResult(`Command timed out after ${timeout_ms}ms`));
		//      }, timeout_ms);
		//
		//      child.on("close", (code) => {
		//        clearTimeout(timer);
		//        // Truncate if too long
		//        if (output.length > MAX_OUTPUT_CHARS) output = output.slice(0, MAX_OUTPUT_CHARS) + "\n[output truncated]";
		//        if (code !== 0) resolve(errorResult(`Exit ${code}:\n${output}`));
		//        else resolve(okResult(output || "(no output)"));
		//      });
		//    });

		void input;
		void spawn;
		void DEFAULT_TIMEOUT_MS;
		void MAX_OUTPUT_CHARS;
		void okResult;
		void errorResult;
		throw new Error("Bash tool not implemented yet — see comments above");
	},
};
