// Phase 2 test — run: npm run test:tools
// Tests all tools without needing any API keys

import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { readTool } from "../src/tools/read.js";
import { writeTool } from "../src/tools/write.js";
import { editTool } from "../src/tools/edit.js";
import { bashTool } from "../src/tools/bash.js";
import { grepTool } from "../src/tools/grep.js";
import { findTool } from "../src/tools/find.js";
import { lsTool } from "../src/tools/ls.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
	if (condition) {
		console.log(`  ✓ ${message}`);
		passed++;
	} else {
		console.error(`  ✗ FAILED: ${message}`);
		failed++;
	}
}

const testDir = join(tmpdir(), "pi-clone-test");
const testFile = join(testDir, "test.txt");

// --- Write tool ---
console.log("\nWrite tool:");
{
	const r = await writeTool.execute({ file_path: testFile, content: "Hello World\nLine 2\nLine 3" });
	assert(!r.isError, "Write succeeds");
	assert(r.output.includes(testFile), "Output contains file path");
}

// --- Read tool ---
console.log("\nRead tool:");
{
	const r = await readTool.execute({ file_path: testFile });
	assert(!r.isError, "Read succeeds");
	assert(r.output.includes("Hello World"), "Contains file content");
	assert(r.output.includes("1\t"), "Has line numbers");

	const r2 = await readTool.execute({ file_path: testFile, offset: 2, limit: 1 });
	assert(!r2.isError, "Read with offset succeeds");
	assert(r2.output.includes("Line 2"), "Offset returns correct line");
	assert(!r2.output.includes("Line 3"), "Limit cuts off at right line");

	const rMissing = await readTool.execute({ file_path: "/nonexistent/file.txt" });
	assert(rMissing.isError, "Read missing file returns error");
}

// --- Edit tool ---
console.log("\nEdit tool:");
{
	const r = await editTool.execute({ file_path: testFile, old_string: "Hello World", new_string: "Hello Pi-Clone" });
	assert(!r.isError, "Edit succeeds");

	const verify = await readTool.execute({ file_path: testFile });
	assert(verify.output.includes("Hello Pi-Clone"), "Edit actually changed the file");

	const rBad = await editTool.execute({ file_path: testFile, old_string: "DOES NOT EXIST", new_string: "x" });
	assert(rBad.isError, "Edit with missing old_string returns error");
}

// --- Bash tool ---
console.log("\nBash tool:");
{
	const r = await bashTool.execute({ command: "echo hello-from-bash" });
	assert(!r.isError, "Bash succeeds");
	assert(r.output.includes("hello-from-bash"), "Bash output is correct");

	const rErr = await bashTool.execute({ command: "exit 1" });
	assert(rErr.isError, "Non-zero exit returns error");
}

// --- Grep tool ---
console.log("\nGrep tool:");
{
	const r = await grepTool.execute({ pattern: "Pi-Clone", path: testDir });
	assert(!r.isError, "Grep succeeds");
	assert(r.output.includes("Pi-Clone"), "Grep finds the pattern");

	const rNone = await grepTool.execute({ pattern: "XYZNOTFOUND12345", path: testDir });
	assert(!rNone.isError, "Grep with no matches doesn't error");
}

// --- Find tool ---
console.log("\nFind tool:");
{
	const r = await findTool.execute({ pattern: "*.txt", path: testDir });
	assert(!r.isError, "Find succeeds");
	assert(r.output.includes("test.txt"), "Find locates the txt file");
}

// --- Ls tool ---
console.log("\nLs tool:");
{
	const r = await lsTool.execute({ path: testDir });
	assert(!r.isError, "Ls succeeds");
	assert(r.output.includes("test.txt"), "Ls shows the file");
}

// Cleanup
rmSync(testDir, { recursive: true, force: true });

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log("✓ All tool tests passed!\n");
