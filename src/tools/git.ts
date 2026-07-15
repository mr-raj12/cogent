// Git operations tool — provides safe git operations without shell injection

import { spawn } from "node:child_process";
import type { Tool } from "./types.js";
import { errorResult, okResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;

/**
 * Executes a git command safely using spawn.
 * Avoids shell injection by passing args separately.
 */
async function executeGitCommand(args: string[], description: string): Promise<{ output: string; error: boolean }> {
	return new Promise((resolve) => {
		const child = spawn("git", args, { cwd: process.cwd() });
		let output = "";
		let errorOutput = "";

		child.stdout.on("data", (d: Buffer) => {
			output += d.toString();
		});

		child.stderr.on("data", (d: Buffer) => {
			errorOutput += d.toString();
		});

		const timer = setTimeout(() => {
			child.kill();
			resolve({ output: `Git command timed out after ${DEFAULT_TIMEOUT_MS}ms`, error: true });
		}, DEFAULT_TIMEOUT_MS);

		child.on("close", (code) => {
			clearTimeout(timer);
			const fullOutput = output + (errorOutput ? errorOutput : "");
			if (fullOutput.length > MAX_OUTPUT_CHARS) {
				return resolve({
					output: `${fullOutput.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`,
					error: true,
				});
			}
			resolve({ output: fullOutput || "(no output)", error: code !== 0 });
		});
	});
}

/**
 * git status — Show working tree status
 * Read-only, safe to run frequently
 */
export const gitStatusTool: Tool = {
	name: "GitStatus",
	description: "Show the current git status (branches, staged/unstaged changes, untracked files)",
	inputSchema: {
		type: "object",
		properties: {
			porcelain: {
				type: "boolean",
				description: "Output in machine-readable format (default: false for human-readable)",
			},
		},
	},
	readOnly: true,

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const args = ["status"];
			if (input.porcelain) args.push("--porcelain");
			const result = await executeGitCommand(args, "git status");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git log — Show commit history
 */
export const gitLogTool: Tool = {
	name: "GitLog",
	description:
		"Show commit history. Use --oneline for compact view, -n <number> to limit commits, --author <name> to filter",
	inputSchema: {
		type: "object",
		properties: {
			limit: {
				type: "number",
				description: "Maximum number of commits to show (default: 10)",
			},
			oneline: {
				type: "boolean",
				description: "Show compact one-line format (default: true)",
			},
			author: {
				type: "string",
				description: "Filter by author name",
			},
			file: {
				type: "string",
				description: "Show history for a specific file",
			},
		},
	},
	readOnly: true,

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const limit = (input.limit as number) ?? 10;
			const oneline = input.oneline !== false;
			const author = input.author as string | undefined;
			const file = input.file as string | undefined;

			const args = ["log", `-n`, String(limit)];
			if (oneline) args.push("--oneline");
			if (author) args.push(`--author=${author}`);
			if (file) args.push("--", file);

			const result = await executeGitCommand(args, "git log");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git diff — Show changes between commits/index/working tree
 */
export const gitDiffTool: Tool = {
	name: "GitDiff",
	description:
		"Show differences. Can compare: staged changes (default), working directory changes (--unstaged), commits, or files. " +
		"Examples: diff latest commit, diff against branch, diff between two commits",
	inputSchema: {
		type: "object",
		properties: {
			unstaged: {
				type: "boolean",
				description: "Show unstaged changes (default: false shows staged)",
			},
			commit1: {
				type: "string",
				description: "First commit/branch to compare (e.g., 'HEAD', 'main')",
			},
			commit2: {
				type: "string",
				description: "Second commit/branch to compare (e.g., 'HEAD~1')",
			},
			file: {
				type: "string",
				description: "Limit diff to specific file path",
			},
			stat: {
				type: "boolean",
				description: "Show only statistics (insertions/deletions per file)",
			},
		},
	},
	readOnly: true,

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const args = ["diff"];
			const unstaged = input.unstaged as boolean;
			const commit1 = input.commit1 as string | undefined;
			const commit2 = input.commit2 as string | undefined;
			const file = input.file as string | undefined;
			const stat = input.stat as boolean;

			if (!unstaged && !commit1 && !commit2) args.push("--cached"); // staged by default
			if (unstaged && !commit1 && !commit2) args.push("--unstaged");
			if (stat) args.push("--stat");
			if (commit1 && commit2) {
				args.push(commit1, commit2);
			} else if (commit1) {
				args.push(commit1);
			}
			if (file) args.push("--", file);

			const result = await executeGitCommand(args, "git diff");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git add — Stage changes
 */
export const gitAddTool: Tool = {
	name: "GitAdd",
	description: "Stage changes for commit. Use '.' to stage all, or specify file paths. Use '--all' to stage deletions too.",
	inputSchema: {
		type: "object",
		properties: {
			paths: {
				type: "array",
				items: { type: "string" },
				description: "Files/directories to stage. Empty array means stage nothing. Use ['.'] to stage all.",
			},
			all: {
				type: "boolean",
				description: "Stage all changes including deletions (default: false)",
			},
		},
		required: ["paths"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const paths = (input.paths as string[]) ?? [];
			const all = input.all as boolean;

			if (paths.length === 0 && !all) {
				return errorResult("No files specified. Pass paths to stage or set all=true");
			}

			const args = ["add"];
			if (all) {
				args.push("--all");
			} else {
				args.push(...paths);
			}

			const result = await executeGitCommand(args, "git add");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git commit — Create a commit with staged changes
 */
export const gitCommitTool: Tool = {
	name: "GitCommit",
	description: "Create a commit with staged changes. Provide a commit message.",
	inputSchema: {
		type: "object",
		properties: {
			message: {
				type: "string",
				description: "Commit message (required)",
			},
			amend: {
				type: "boolean",
				description: "Amend the previous commit instead of creating a new one (default: false)",
			},
		},
		required: ["message"],
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const message = input.message as string;
			const amend = input.amend as boolean;

			if (!message || message.trim().length === 0) {
				return errorResult("Commit message is required and cannot be empty");
			}

			const args = ["commit", "-m", message];
			if (amend) args.push("--amend");

			const result = await executeGitCommand(args, "git commit");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git branch — List, create, or delete branches
 */
export const gitBranchTool: Tool = {
	name: "GitBranch",
	description:
		"List, create, or delete branches. List branches (default), create new branch, or delete a branch. " +
		"Shows current branch with '*'.",
	inputSchema: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: ["list", "create", "delete"],
				description: "Action to perform (default: list)",
			},
			name: {
				type: "string",
				description: "Branch name (required for create/delete)",
			},
			all: {
				type: "boolean",
				description: "List both local and remote branches (for list action)",
			},
		},
	},
	// Not readOnly: the same tool can delete a branch, and readOnly would skip
	// the permission prompt for it. Listing is cheap enough to confirm.

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const action = (input.action as string) ?? "list";
			const name = input.name as string | undefined;
			const all = input.all as boolean;

			const args = ["branch"];
			if (action === "list") {
				if (all) args.push("-a");
			} else if (action === "create") {
				if (!name) return errorResult("Branch name required for create action");
				args.push(name);
			} else if (action === "delete") {
				if (!name) return errorResult("Branch name required for delete action");
				args.push("-d", name);
			}

			const result = await executeGitCommand(args, `git branch ${action}`);
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git checkout — Switch branches or restore files
 */
export const gitCheckoutTool: Tool = {
	name: "GitCheckout",
	description:
		"Switch to a branch, create and switch to a new branch, or restore files from HEAD. " +
		"Use branch parameter to switch branches, -b with branch to create new, or file path to restore.",
	inputSchema: {
		type: "object",
		properties: {
			branch: {
				type: "string",
				description: "Branch name to checkout",
			},
			createNew: {
				type: "boolean",
				description: "Create and checkout new branch (use with branch parameter)",
			},
			file: {
				type: "string",
				description: "File path to restore from HEAD (alternative to branch checkout)",
			},
		},
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const branch = input.branch as string | undefined;
			const createNew = input.createNew as boolean;
			const file = input.file as string | undefined;

			if (!branch && !file) {
				return errorResult("Specify either branch or file parameter");
			}

			const args = ["checkout"];
			if (file) {
				args.push("--", file);
			} else if (branch) {
				if (createNew) args.push("-b");
				args.push(branch);
			}

			const result = await executeGitCommand(args, "git checkout");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * git reset — Unstage changes or reset to a commit
 */
export const gitResetTool: Tool = {
	name: "GitReset",
	description:
		"Unstage changes (default), or reset working directory to a commit. Use 'HEAD' to unstage all, or commit hash/branch to reset. " +
		"--hard discards changes, --soft keeps them.",
	inputSchema: {
		type: "object",
		properties: {
			target: {
				type: "string",
				description: "Commit/branch to reset to (default: HEAD for unstaging)",
			},
			mode: {
				type: "string",
				enum: ["soft", "mixed", "hard"],
				description: "Reset mode: soft (keep changes), mixed (unstage), hard (discard) (default: mixed)",
			},
			file: {
				type: "string",
				description: "Specific file to unstage",
			},
		},
	},

	async execute(input): Promise<ReturnType<typeof okResult>> {
		try {
			const target = (input.target as string) ?? "HEAD";
			const mode = (input.mode as string) ?? "mixed";
			const file = input.file as string | undefined;

			const args = ["reset"];
			if (mode !== "mixed") args.push(`--${mode}`);
			args.push(target);
			if (file) args.push(file);

			const result = await executeGitCommand(args, "git reset");
			return result.error ? errorResult(result.output) : okResult(result.output);
		} catch (err) {
			return errorResult(err);
		}
	},
};

/**
 * Collection of all git tools
 */
export const GIT_TOOLS: Tool[] = [
	gitStatusTool,
	gitLogTool,
	gitDiffTool,
	gitAddTool,
	gitCommitTool,
	gitBranchTool,
	gitCheckoutTool,
	gitResetTool,
];
