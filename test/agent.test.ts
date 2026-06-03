// Phase 3 test — run: npm run test:agent
// Tests the full agent loop end-to-end (needs at least one API key)

import { runAgent } from "../src/agent/loop.js";
import { writeTool } from "../src/tools/write.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

const geminiKey = process.env.GEMINI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

const providerName = geminiKey ? "gemini" : groqKey ? "groq" : null;
const model = geminiKey ? "gemini-2.5-flash" : "llama-3.3-70b-versatile";

if (!providerName) {
	console.error("No API keys found. Set GEMINI_API_KEY or GROQ_API_KEY.");
	process.exit(1);
}

const testFile = join(tmpdir(), "pi-clone-agent-test.txt");

console.log(`\nTesting agent loop with ${providerName}/${model}...`);

// Write a test file for the agent to read
await writeTool.execute({ file_path: testFile, content: "The secret word is: banana" });

let gotTextDelta = false;
let gotToolStart = false;
let gotToolEnd = false;
let gotAgentEnd = false;
let finalText = "";

for await (const event of runAgent({
	providerName,
	model,
	system: "You are a helpful assistant. Use tools when needed.",
	messages: [{ role: "user", content: `Read the file ${testFile} and tell me the secret word.` }],
	maxTurns: 5,
})) {
	switch (event.type) {
		case "text_delta":
			gotTextDelta = true;
			finalText += event.delta;
			process.stdout.write(event.delta);
			break;
		case "tool_start":
			gotToolStart = true;
			console.log(`\n[Tool: ${event.name}]`);
			break;
		case "tool_end":
			gotToolEnd = true;
			console.log(`[Result: ${event.result.slice(0, 100)}]`);
			break;
		case "agent_end":
			gotAgentEnd = true;
			break;
	}
}

console.log("\n");

let passed = 0;
let failed = 0;

function check(condition: boolean, msg: string) {
	if (condition) { console.log(`✓ ${msg}`); passed++; }
	else { console.error(`✗ FAILED: ${msg}`); failed++; }
}

check(gotTextDelta, "Agent produced text output");
check(gotToolStart, "Agent called a tool (Read)");
check(gotToolEnd, "Tool execution completed");
check(gotAgentEnd, "Agent loop ended cleanly");
check(finalText.toLowerCase().includes("banana"), "Agent found the secret word");

// Cleanup
rmSync(testFile, { force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log("✓ Agent test passed!\n");
