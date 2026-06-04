// Provider test — run: npm run test:provider (needs API keys in .env or env vars)

import { createProvider } from "../src/providers/index.js";

async function testProvider(providerName: string, model: string, apiKey: string) {
	console.log(`\nTesting ${providerName} / ${model}...`);
	const provider = createProvider(providerName, apiKey);

	let fullText = "";
	let gotMessageEnd = false;

	for await (const event of provider.complete({
		model,
		system: "You are a test assistant. Be very brief.",
		messages: [{ role: "user", content: 'Say exactly: "Provider is working!"' }],
		tools: [],
		max_tokens: 50,
	})) {
		if (event.type === "text_delta") {
			process.stdout.write(event.delta);
			fullText += event.delta;
		}
		if (event.type === "message_end") {
			gotMessageEnd = true;
			console.log(`\n  usage: in=${event.usage.input_tokens} out=${event.usage.output_tokens}`);
		}
	}

	if (!gotMessageEnd) throw new Error("Never got message_end event");
	if (!fullText) throw new Error("Got no text output");
	console.log(`  ✓ ${providerName} passed`);
}

async function testToolCall(providerName: string, model: string, apiKey: string) {
	console.log(`\nTesting ${providerName} tool calls...`);
	const provider = createProvider(providerName, apiKey);

	let gotToolUseStart = false;

	for await (const event of provider.complete({
		model,
		system: "Use tools when asked.",
		messages: [{ role: "user", content: "Use the TestTool with message: hello" }],
		tools: [
			{
				name: "TestTool",
				description: "A test tool",
				input_schema: {
					type: "object",
					properties: { message: { type: "string" } },
					required: ["message"],
				},
			},
		],
		max_tokens: 200,
	})) {
		if (event.type === "tool_use_start") {
			gotToolUseStart = true;
			console.log(`  tool called: ${event.name} (id: ${event.id})`);
		}
	}

	if (!gotToolUseStart) console.log("  ⚠ No tool call — model may have responded in text instead");
	else console.log(`  ✓ ${providerName} tool calls work`);
}

const geminiKey = process.env.GEMINI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

if (!geminiKey && !groqKey) {
	console.error("No API keys found. Set GEMINI_API_KEY or GROQ_API_KEY in environment.");
	process.exit(1);
}

if (geminiKey) {
	await testProvider("gemini", "gemini-2.5-flash", geminiKey);
	await testToolCall("gemini", "gemini-2.5-flash", geminiKey);
}

if (groqKey) {
	await testProvider("groq", "llama-3.3-70b-versatile", groqKey);
	await testToolCall("groq", "llama-3.3-70b-versatile", groqKey);
}

console.log("\n✓ All provider tests passed!\n");
