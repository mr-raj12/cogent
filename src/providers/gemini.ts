// PHASE 1 — Implement the Gemini provider
// Docs: https://ai.google.dev/gemini-api/docs/get-started/node
// SDK: @google/genai

import { GoogleGenAI } from "@google/genai";
import { consola } from "consola";
import type { Provider, CompletionOptions, StreamEvent } from "./types.js";
import type { ContentBlock } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// toGeminiContents(messages)
//
// INPUT  — our universal Message[] format:
//   [
//     { role: "user",      content: "Read /foo.txt for me" },
//
//     { role: "assistant", content: [
//         { type: "tool_use", id: "call_1", name: "read_file", input: { file_path: "/foo.txt" } }
//     ]},
//
//     { role: "user", content: [
//         { type: "tool_result", tool_use_id: "call_1", content: "hello world", is_error: false }
//     ]}
//   ]
//
// OUTPUT — Gemini's Content[] format:
//   [
//     { role: "user",  parts: [{ text: "Read /foo.txt for me" }] },
//
//     { role: "model", parts: [{ functionCall: { name: "read_file", args: { file_path: "/foo.txt" } } }] },
//
//     { role: "user",  parts: [{ functionResponse: { name: "call_1", response: { output: "hello world", is_error: false } } }] }
//   ]
//
// KEY RULES:
//   - system messages are filtered OUT (Gemini takes them in config.systemInstruction instead)
//   - "assistant" role → "model" role  (Gemini's word for it)
//   - "user" role → stays "user"
//   - plain string content → { parts: [{ text: "..." }] }
//   - ContentBlock[] content → each block becomes its own part type
// ─────────────────────────────────────────────────────────────────────────────
function toGeminiContents(messages: CompletionOptions["messages"]) {
	return messages
		.filter((m) => m.role !== "system") // system goes in config.systemInstruction, not here
		.map((m) => {
			const role = m.role === "assistant" ? "model" : "user";
			// role is now either "model" or "user" — Gemini's two valid roles

			// Case A: content is a plain string (most user messages)
			// input:  { role: "user", content: "hello" }
			// output: { role: "user", parts: [{ text: "hello" }] }
			if (typeof m.content === "string") {
				return { role, parts: [{ text: m.content }] };
			}

			// Case B: content is an array of ContentBlocks — map each to a Gemini part
			const parts = m.content.map((block: ContentBlock) => {
				// TextBlock
				// input:  { type: "text", text: "sure, here it is" }
				// output: { text: "sure, here it is" }
				if (block.type === "text") {
					return { text: block.text };
				}

				// ToolUseBlock — the assistant decided to call a tool
				// input:  { type: "tool_use", id: "call_1", name: "read_file", input: { file_path: "/foo.txt" } }
				// output: { functionCall: { name: "read_file", args: { file_path: "/foo.txt" } } }
				// NOTE: Gemini doesn't track an id — we generate one ourselves later when streaming
				if (block.type === "tool_use") {
					return { functionCall: { name: block.name, args: block.input } };
				}

				// ToolResultBlock — the tool ran and here's its output
				// input:  { type: "tool_result", tool_use_id: "call_1", content: "file contents", is_error: false }
				// output: { functionResponse: { name: "call_1", response: { output: "file contents", is_error: false } } }
				// NOTE: this goes in a "user" role turn — Gemini treats tool results as user messages
				if (block.type === "tool_result") {
					return {
						functionResponse: {
							name: block.tool_use_id,
							response: { output: block.content, is_error: block.is_error ?? false },
						},
					};
				}

				return { text: "" }; // fallback — should never hit this
			});

			return { role, parts };
		});
}

// ─────────────────────────────────────────────────────────────────────────────
// createGeminiProvider(apiKey)
//
// INPUT  — apiKey: string  e.g. "AIzaSy..."
// OUTPUT — a Provider object:
//   {
//     name: "gemini",
//     complete(options): AsyncGenerator<StreamEvent>
//   }
//
// The caller (agent loop) uses it like:
//   const provider = createGeminiProvider("AIzaSy...");
//   for await (const event of provider.complete(options)) { ... }
// ─────────────────────────────────────────────────────────────────────────────
export function createGeminiProvider(apiKey: string): Provider {
	// client is the Gemini SDK instance — holds the API key, used for all requests
	const client = new GoogleGenAI({ apiKey });

	return {
		name: "gemini",

		// ─────────────────────────────────────────────────────────────────────
		// complete(options)
		//
		// This is an async generator — it `yield`s events one at a time.
		// The caller receives each event as soon as it's yielded, without waiting
		// for the whole response to finish. This is how streaming works.
		//
		// `yield` = "here's one event, pause, wait for caller to ask for the next"
		//
		// INPUT — options: CompletionOptions
		//   {
		//     model:       "gemini-2.5-flash",
		//     system:      "You are a helpful assistant.",
		//     messages:    [ { role: "user", content: "What is 2+2?" } ],
		//     tools:       [ { name: "read_file", description: "...", input_schema: { type: "object", ... } } ],
		//     max_tokens:  1024,
		//     temperature: 0.7
		//   }
		//
		// OUTPUT — yields StreamEvent, one at a time:
		//   { type: "text_delta",           delta: "The answer" }
		//   { type: "text_delta",           delta: " is 4." }
		//   { type: "tool_use_start",       id: "uuid-...", name: "read_file" }
		//   { type: "tool_use_input_delta", id: "uuid-...", delta: '{"file_path":"/foo.txt"}' }
		//   { type: "tool_use_end",         id: "uuid-..." }
		//   { type: "message_end",          stop_reason: "end_turn", usage: { input_tokens: 50, output_tokens: 12 } }
		// ─────────────────────────────────────────────────────────────────────
		async *complete(options: CompletionOptions): AsyncGenerator<StreamEvent> {
			// ── STEP 1: Build Gemini-format tool declarations ──────────────────
			//
			// Our format (ToolDefinition[]):
			//   [{ name: "read_file", description: "Reads a file", input_schema: { type: "object", properties: {...}, required: [...] } }]
			//
			// Gemini needs it wrapped in functionDeclarations:
			//   [{ functionDeclarations: [{ name: "read_file", description: "Reads a file", parameters: { type: "object", ... } }] }]
			//
			// If there are no tools, pass undefined (not an empty array — Gemini treats them differently)
			consola.info(`\n🟦 [GEMINI] ── complete() called ──────────────────────────────`);
			consola.info(`   model      : ${options.model}`);
			consola.info(`   messages   : ${options.messages.length}`);
			consola.info(`   max_tokens : ${options.max_tokens}`);
			consola.info(`   temperature: ${options.temperature}`);

			const tools =
				options.tools.length > 0
					? [
							{
								functionDeclarations: options.tools.map((t) => ({
									name: t.name,
									description: t.description,
									parameters: t.input_schema, // "parameters" is Gemini's key, our key is "input_schema"
								})),
							},
						]
					: undefined;

			if (tools) {
				consola.success(`   🔧 Tools registered: ${options.tools.map((t) => t.name).join(", ")}`);
			} else {
				consola.warn(`   ⚠️  No tools provided`);
			}

			// ── STEP 2: Convert our messages to Gemini's Content[] format ──────
			//
			// calls toGeminiContents() defined above
			// system message is NOT passed here — it goes in config.systemInstruction below
			const contents = toGeminiContents(options.messages);
			consola.info(`\n🟨 [GEMINI] ── Messages converted ─────────────────────────────`);
			consola.info(`   System message chars : ${options.system?.length ?? 0}`);
			consola.info(`   Gemini content turns : ${contents.length}`);

			// ── STEP 3: Start the streaming request ────────────────────────────
			//
			// generateContentStream fires the HTTP request and returns a stream object.
			// The stream is NOT the response itself — it's an async iterable of chunks.
			// Each chunk arrives as the model generates more tokens.
			//
			// config fields:
			//   systemInstruction — the system prompt (Gemini's name for it)
			//   tools             — the functionDeclarations from step 1
			//   maxOutputTokens   — stop after this many tokens
			//   temperature       — 0 = deterministic, 1 = creative
			consola.info(`\n🟩 [GEMINI] ── Sending request to API ─────────────────────────`);
			const stream = await client.models.generateContentStream({
				model: options.model,
				contents,
				config: {
					systemInstruction: options.system,
					tools,
					maxOutputTokens: options.max_tokens,
					temperature: options.temperature,
				},
			});
			consola.success(`   ✅ Stream opened — iterating chunks…`);

			// ── STEP 4: Iterate chunks and yield StreamEvents ──────────────────
			//
			// Each `chunk` from the stream is one of these shapes:
			//
			// TEXT CHUNK (model is writing words):
			//   {
			//     candidates: [{
			//       content: { parts: [{ text: "The answer is " }] },
			//       finishReason: undefined
			//     }]
			//     // usageMetadata field is absent on non-final chunks
			//   }
			//
			// TOOL CALL CHUNK (model wants to call a function):
			//   {
			//     candidates: [{
			//       content: {
			//         parts: [{
			//           functionCall: {
			//             name: "Read",
			//             args: { file_path: "/foo.txt" }   ← COMPLETE object, not fragmented
			//           }
			//         }]
			//       },
			//       finishReason: undefined
			//     }]
			//     // usageMetadata field is absent on non-final chunks
			//   }
			//
			// FINAL CHUNK (stream is over, no content parts):
			//   {
			//     candidates: [{ finishReason: "STOP", content: undefined }],
			//     usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 12, totalTokenCount: 62 }
			//   }
			//
			// NOTE: Gemini sends the COMPLETE args object in one chunk (not fragmented).
			// Groq sends args as string fragments across many chunks.
			// That's why we JSON.stringify the whole args and emit it as a single input_delta.
			//
			// chunk.candidates?.[0]?.content?.parts ?? []
			//   → safely gets the parts array, defaults to [] if anything is null/undefined
			let chunkCount = 0;
			let textDeltaCount = 0;
			let toolCallCount = 0;
			let inputTokens = 0;
			let outputTokens = 0;

			for await (const chunk of stream) {
				chunkCount++;
				if (chunk.usageMetadata) {
					inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
					outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
				}

				for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
					// ── TEXT PART ────────────────────────────────────────────────
					// part = { text: "The answer is 4." }
					// yield → { type: "text_delta", delta: "The answer is 4." }
					if (part.text) {
						textDeltaCount++;
						consola.debug(`   📝 text_delta  #${textDeltaCount}  (${part.text.length} chars)`);
						yield { type: "text_delta", delta: part.text };
					}

					// ── FUNCTION CALL PART ───────────────────────────────────────
					// part = { functionCall: { name: "read_file", args: { file_path: "/foo.txt" } } }
					//
					// Gemini doesn't give us a call id — we generate one with crypto.randomUUID()
					// e.g. id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
					//
					// We emit 3 events for one tool call:
					//   1. tool_use_start       → tells agent loop "a tool call is beginning"
					//   2. tool_use_input_delta → the complete JSON args as a string
					//   3. tool_use_end         → tells agent loop "tool call is fully received"
					//
					// The agent loop collects input_deltas and JSON.parses the full string
					// after tool_use_end to get the final input object for executing the tool.
					if (part.functionCall) {
						toolCallCount++;
						const id = crypto.randomUUID();
						consola.info(`\n🟪 [GEMINI] ── Tool call #${toolCallCount} ─────────────────────────────`);
						consola.info(`   name : ${part.functionCall.name}`);
						consola.info(`   id   : ${id}`);
						consola.info(`   args : ${JSON.stringify(part.functionCall.args ?? {})}`);
						yield { type: "tool_use_start", id, name: part.functionCall.name! };
						yield {
							type: "tool_use_input_delta",
							id,
							delta: JSON.stringify(part.functionCall.args ?? {}),
						};
						yield { type: "tool_use_end", id };
						consola.success(`   ✅ tool_use_end emitted for "${part.functionCall.name}"`);
					}
				}
			}

			consola.info(`\n🟧 [GEMINI] ── Stream finished ────────────────────────────────`);
			consola.info(`   Total chunks     : ${chunkCount}`);
			consola.info(`   Text deltas      : ${textDeltaCount}`);
			consola.info(`   Tool calls       : ${toolCallCount}`);

			// ── STEP 5: Emit message_end with token usage ──────────────────────
			//
			// inputTokens / outputTokens were collected inside the loop above.
			// Gemini only populates usageMetadata on the FINAL chunk, and it sends
			// cumulative totals (not per-chunk deltas), so we use = not +=.
			// By the time the loop exits, these hold the complete counts.
			//
			// We yield ONE final event to tell the agent loop the turn is done:
			//   { type: "message_end", stop_reason: "end_turn", usage: { input_tokens: 50, output_tokens: 12 } }
			//
			// stop_reason is always "end_turn" for Gemini.
			// If the model called a tool it still says "end_turn" — the agent loop
			// knows tools were called because it already saw tool_use_start events.
			consola.info(`\n🟥 [GEMINI] ── message_end ─────────────────────────────────────`);
			consola.info(`   input_tokens  : ${inputTokens}`);
			consola.info(`   output_tokens : ${outputTokens}`);
			yield {
				type: "message_end",
				stop_reason: "end_turn",
				usage: { input_tokens: inputTokens, output_tokens: outputTokens },
			};
			consola.success(`   ✅ message_end emitted — Gemini turn complete\n`);
		},
	};
}
