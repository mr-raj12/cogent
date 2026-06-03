// PHASE 1 — Implement the Gemini provider
// Docs: https://ai.google.dev/gemini-api/docs/get-started/node
// SDK: @google/genai

import { GoogleGenAI } from "@google/genai";
import type { Provider, CompletionOptions, StreamEvent } from "./types.js";
import type { ContentBlock } from "../types.js";

// Convert our universal Message[] into the format Gemini expects
function toGeminiContents(messages: CompletionOptions["messages"]) {
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			const role = m.role === "assistant" ? "model" : "user";

			// String content → simple text part
			if (typeof m.content === "string") {
				return { role, parts: [{ text: m.content }] };
			}

			// ContentBlock[] → convert each block type
			const parts = m.content.map((block: ContentBlock) => {
				if (block.type === "text") {
					return { text: block.text };
				}
				if (block.type === "tool_use") {
					// Assistant called a tool
					return { functionCall: { name: block.name, args: block.input } };
				}
				if (block.type === "tool_result") {
					// Tool result coming back to the model
					// Gemini expects functionResponse inside a "user" turn
					return {
						functionResponse: {
							name: block.tool_use_id, // will be matched by name in practice
							response: { output: block.content, is_error: block.is_error ?? false },
						},
					};
				}
				return { text: "" };
			});

			return { role, parts };
		});
}

export function createGeminiProvider(apiKey: string): Provider {
	const client = new GoogleGenAI({ apiKey });

	return {
		name: "gemini",

		async *complete(options: CompletionOptions): AsyncGenerator<StreamEvent> {
			// TODO PHASE 1 — Fill in the body below.
			// The conversion helpers above are already done for you.
			//
			// Step 1: Build tool declarations for Gemini
			//   const tools = options.tools.length > 0
			//     ? [{ functionDeclarations: options.tools.map(t => ({
			//         name: t.name,
			//         description: t.description,
			//         parameters: t.input_schema
			//       })) }]
			//     : undefined;
			//
			// Step 2: Convert messages
			//   const contents = toGeminiContents(options.messages);
			//
			// Step 3: Start streaming
			//   const stream = await client.models.generateContentStream({
			//     model: options.model,
			//     contents,
			//     config: {
			//       systemInstruction: options.system,
			//       tools,
			//       maxOutputTokens: options.max_tokens,
			//       temperature: options.temperature,
			//     }
			//   });
			//
			// Step 4: Iterate the stream and yield StreamEvents
			//   for await (const chunk of stream) {
			//     for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
			//       if (part.text) {
			//         yield { type: "text_delta", delta: part.text };
			//       }
			//       if (part.functionCall) {
			//         const id = crypto.randomUUID();
			//         yield { type: "tool_use_start", id, name: part.functionCall.name! };
			//         yield { type: "tool_use_input_delta", id, delta: JSON.stringify(part.functionCall.args ?? {}) };
			//         yield { type: "tool_use_end", id };
			//       }
			//     }
			//   }
			//
			// Step 5: Emit message_end with usage
			//   const finalResponse = await stream.response;  // resolves after stream done
			//   const u = finalResponse.usageMetadata;
			//   yield {
			//     type: "message_end",
			//     stop_reason: "end_turn",
			//     usage: { input_tokens: u?.promptTokenCount ?? 0, output_tokens: u?.candidatesTokenCount ?? 0 }
			//   };

			throw new Error("Gemini provider not implemented yet — see comments above");
		},
	};
}
