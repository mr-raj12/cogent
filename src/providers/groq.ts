// PHASE 1 — Implement the Groq provider
// Docs: https://console.groq.com/docs/openai
// SDK: groq-sdk (OpenAI-compatible format)

import Groq from "groq-sdk";
import type { Provider, CompletionOptions, StreamEvent } from "./types.js";
import type { ContentBlock } from "../types.js";

// Convert our universal Message[] into OpenAI/Groq format
function toGroqMessages(messages: CompletionOptions["messages"]) {
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			if (typeof m.content === "string") {
				return { role: m.role as "user" | "assistant", content: m.content };
			}

			// Flatten ContentBlocks — Groq uses a different tool_call format
			const textParts = m.content
				.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
				.map((b) => b.text)
				.join("");

			const toolCalls = m.content
				.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
				.map((b) => ({
					id: b.id,
					type: "function" as const,
					function: { name: b.name, arguments: JSON.stringify(b.input) },
				}));

			if (m.role === "assistant") {
				return {
					role: "assistant" as const,
					content: textParts || null,
					...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
				};
			}

			// Tool results come back as separate "tool" role messages
			const toolResults = m.content.filter(
				(b): b is Extract<ContentBlock, { type: "tool_result" }> => b.type === "tool_result",
			);

			if (toolResults.length > 0) {
				// Return multiple messages — one per tool result
				// Note: in practice flatten this — see agent loop
				return toolResults.map((b) => ({
					role: "tool" as const,
					tool_call_id: b.tool_use_id,
					content: b.content,
				}));
			}

			return { role: "user" as const, content: textParts };
		})
		.flat();
}

export function createGroqProvider(apiKey: string): Provider {
	const client = new Groq({ apiKey });

	return {
		name: "groq",

		async *complete(options: CompletionOptions): AsyncGenerator<StreamEvent> {
			// TODO PHASE 1 — Fill in the body below.
			// toGroqMessages() is already written above to help you.
			//
			// Step 1: Build system message + history
			//   const messages = [
			//     { role: "system", content: options.system },
			//     ...toGroqMessages(options.messages),
			//   ];
			//
			// Step 2: Build tool definitions (OpenAI format)
			//   const tools = options.tools.map(t => ({
			//     type: "function" as const,
			//     function: {
			//       name: t.name,
			//       description: t.description,
			//       parameters: t.input_schema,
			//     }
			//   }));
			//
			// Step 3: Start streaming
			//   const stream = await client.chat.completions.create({
			//     model: options.model,
			//     messages,
			//     tools: tools.length > 0 ? tools : undefined,
			//     stream: true,
			//     max_tokens: options.max_tokens,
			//     temperature: options.temperature,
			//   });
			//
			// Step 4: Iterate stream chunks and yield events
			//   Groq sends chunks where each chunk has choices[0].delta
			//   The delta has: .content (text) and .tool_calls[] (tool calls)
			//   Tool calls arrive in pieces — accumulate by index, then emit when done.
			//
			//   const toolCallAccumulator: Record<number, { id: string; name: string; args: string }> = {};
			//
			//   for await (const chunk of stream) {
			//     const delta = chunk.choices[0]?.delta;
			//     if (!delta) continue;
			//
			//     if (delta.content) {
			//       yield { type: "text_delta", delta: delta.content };
			//     }
			//
			//     for (const tc of delta.tool_calls ?? []) {
			//       const idx = tc.index;
			//       if (tc.id) {
			//         toolCallAccumulator[idx] = { id: tc.id, name: tc.function?.name ?? "", args: "" };
			//         yield { type: "tool_use_start", id: tc.id, name: tc.function?.name ?? "" };
			//       }
			//       if (tc.function?.arguments) {
			//         toolCallAccumulator[idx]!.args += tc.function.arguments;
			//         yield { type: "tool_use_input_delta", id: toolCallAccumulator[idx]!.id, delta: tc.function.arguments };
			//       }
			//     }
			//   }
			//
			//   // Emit tool_use_end for each accumulated tool call
			//   for (const tc of Object.values(toolCallAccumulator)) {
			//     yield { type: "tool_use_end", id: tc.id };
			//   }
			//
			// Step 5: Get final usage
			//   const finalChunk = await stream.finalChatCompletion();
			//   const u = finalChunk.usage;
			//   yield {
			//     type: "message_end",
			//     stop_reason: finalChunk.choices[0]?.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
			//     usage: { input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0 }
			//   };

			throw new Error("Groq provider not implemented yet — see comments above");
		},
	};
}
