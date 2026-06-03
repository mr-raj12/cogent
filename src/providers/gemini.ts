// Gemini provider — wraps @google/genai and adapts it to our streaming
// Provider interface. Docs: https://ai.google.dev/gemini-api/docs

import { GoogleGenAI } from "@google/genai";
import { consola } from "consola";
import type { ContentBlock } from "../types.js";
import type { CompletionOptions, Provider, StreamEvent } from "./types.js";

// Translate our universal Message[] into Gemini's Content[] format.
//
//   our message                                              gemini content
//   { role: "user", content: "hi" }                       → { role: "user",  parts: [{ text: "hi" }] }
//   { role: "assistant", content: [tool_use] }            → { role: "model", parts: [{ functionCall }] }
//   { role: "user", content: [tool_result] }              → { role: "user",  parts: [{ functionResponse }] }
//
// System messages are dropped here — Gemini takes them in config.systemInstruction.
// "assistant" maps to Gemini's "model" role; Gemini has no concept of a tool id.
function toGeminiContents(messages: CompletionOptions["messages"]) {
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			const role = m.role === "assistant" ? "model" : "user";

			if (typeof m.content === "string") {
				return { role, parts: [{ text: m.content }] };
			}

			const parts = m.content.map((block: ContentBlock) => {
				if (block.type === "text") {
					return { text: block.text };
				}
				if (block.type === "tool_use") {
					return { functionCall: { name: block.name, args: block.input } };
				}
				if (block.type === "tool_result") {
					return {
						functionResponse: {
							name: block.tool_use_id,
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
			// Gemini wants tool declarations wrapped in functionDeclarations, and
			// expects `undefined` (not an empty array) when there are no tools.
			const tools =
				options.tools.length > 0
					? [
							{
								functionDeclarations: options.tools.map((t) => ({
									name: t.name,
									description: t.description,
									parameters: t.input_schema,
								})),
							},
						]
					: undefined;

			const contents = toGeminiContents(options.messages);
			consola.debug(`gemini: ${options.model}, ${contents.length} turns, ${options.tools.length} tools`);

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

			// Gemini only reports usage on the final chunk, as a running total.
			let inputTokens = 0;
			let outputTokens = 0;

			for await (const chunk of stream) {
				if (chunk.usageMetadata) {
					inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
					outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
				}

				for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
					if (part.text) {
						yield { type: "text_delta", delta: part.text };
					}

					// Gemini sends the complete args object in a single chunk and gives
					// no call id, so we mint one and emit start/input/end together.
					if (part.functionCall) {
						const id = crypto.randomUUID();
						yield { type: "tool_use_start", id, name: part.functionCall.name! };
						yield {
							type: "tool_use_input_delta",
							id,
							delta: JSON.stringify(part.functionCall.args ?? {}),
						};
						yield { type: "tool_use_end", id };
					}
				}
			}

			// Gemini always reports "end_turn"; the agent loop detects tool calls from
			// the tool_use events it already received.
			yield {
				type: "message_end",
				stop_reason: "end_turn",
				usage: { input_tokens: inputTokens, output_tokens: outputTokens },
			};
		},
	};
}
