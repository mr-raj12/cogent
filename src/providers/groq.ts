// PHASE 1 — Implement the Groq provider
// Docs: https://console.groq.com/docs/openai
// SDK: groq-sdk (OpenAI-compatible format)

import Groq from "groq-sdk";
import { consola } from "consola";
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
			// Step 1: Build system message + history
			consola.info(`\n🟦 [GROQ] ── complete() called ────────────────────────────────`);
			consola.info(`   model      : ${options.model}`);
			consola.info(`   messages   : ${options.messages.length}`);
			consola.info(`   max_tokens : ${options.max_tokens}`);
			consola.info(`   temperature: ${options.temperature}`);

			const messages = [
			    { role: "system", content: options.system },
			    ...toGroqMessages(options.messages),
			  ];
			consola.info(`\n🟨 [GROQ] ── Messages built ───────────────────────────────────`);
			consola.info(`   System message chars : ${options.system?.length ?? 0}`);
			consola.info(`   Total message turns  : ${messages.length}`);

			// Step 2: Build tool definitions (OpenAI format)
			const tools = options.tools.map(t => ({
			    type: "function" as const,
			    function: {
			      name: t.name,
			      description: t.description,
			      parameters: t.input_schema,
			    }
			  }));

			if (tools.length > 0) {
				consola.success(`   🔧 Tools registered: ${options.tools.map(t => t.name).join(", ")}`);
			} else {
				consola.warn(`   ⚠️  No tools provided`);
			}

			// Step 3: Start streaming
			consola.info(`\n🟩 [GROQ] ── Sending request to API ──────────────────────────`);
			const stream = await client.chat.completions.create({
			    model: options.model,
			    messages: messages as any,
			    tools: tools.length > 0 ? tools : undefined,
			    stream: true,
			    max_tokens: options.max_tokens,
			    temperature: options.temperature,
			  });
			consola.success(`   ✅ Stream opened — iterating chunks…`);

			// Step 4: Iterate stream chunks and yield events
			const toolCallAccumulator: Record<number, { id: string; name: string; args: string }> = {};
			let finishReason: string = "end_turn";
			let promptTokens = 0;
			let completionTokens = 0;
			let chunkCount = 0;
			let textDeltaCount = 0;

			for await (const chunk of stream) {
			    chunkCount++;
			    const delta = chunk.choices[0]?.delta;
			    if (chunk.choices[0]?.finish_reason) {
			      finishReason = chunk.choices[0].finish_reason;
			      consola.info(`   🏁 finish_reason: ${finishReason}`);
			    }
			    if (chunk.x_groq?.usage) {
			      promptTokens = chunk.x_groq.usage.prompt_tokens ?? 0;
			      completionTokens = chunk.x_groq.usage.completion_tokens ?? 0;
			    }
			    if (!delta) continue;

			    if (delta.content) {
			      textDeltaCount++;
			      consola.debug(`   📝 text_delta  #${textDeltaCount}  (${delta.content.length} chars)`);
			      yield { type: "text_delta", delta: delta.content };
			    }

			    for (const tc of delta.tool_calls ?? []) {
			      const idx = tc.index;
			      if (tc.id) {
			        consola.info(`\n🟪 [GROQ] ── Tool call started ───────────────────────────────`);
			        consola.info(`   index : ${idx}`);
			        consola.info(`   id    : ${tc.id}`);
			        consola.info(`   name  : ${tc.function?.name ?? "(unknown)"}`);
			        toolCallAccumulator[idx] = { id: tc.id, name: tc.function?.name ?? "", args: "" };
			        yield { type: "tool_use_start", id: tc.id, name: tc.function?.name ?? "" };
			      }
			      if (tc.function?.arguments) {
			        toolCallAccumulator[idx]!.args += tc.function.arguments;
			        consola.debug(`   📦 args delta for idx ${idx}: ${tc.function.arguments}`);
			        yield { type: "tool_use_input_delta", id: toolCallAccumulator[idx]!.id, delta: tc.function.arguments };
			      }
			    }
			  }

			consola.info(`\n🟧 [GROQ] ── Stream finished ──────────────────────────────────`);
			consola.info(`   Total chunks  : ${chunkCount}`);
			consola.info(`   Text deltas   : ${textDeltaCount}`);
			consola.info(`   Tool calls    : ${Object.keys(toolCallAccumulator).length}`);

			for (const tc of Object.values(toolCallAccumulator)) {
			    consola.success(`   ✅ tool_use_end  "${tc.name}"  (id: ${tc.id})`);
			    consola.info(`   full args: ${tc.args}`);
			    yield { type: "tool_use_end", id: tc.id };
			  }

			// Step 5: Emit message_end
			consola.info(`\n🟥 [GROQ] ── message_end ───────────────────────────────────────`);
			consola.info(`   stop_reason   : ${finishReason === "tool_calls" ? "tool_use" : "end_turn"}`);
			consola.info(`   input_tokens  : ${promptTokens}`);
			consola.info(`   output_tokens : ${completionTokens}`);
			yield {
			    type: "message_end",
			    stop_reason: finishReason === "tool_calls" ? "tool_use" : "end_turn",
			    usage: { input_tokens: promptTokens, output_tokens: completionTokens }
			  };
			consola.success(`   ✅ message_end emitted — Groq turn complete\n`);
		},
	};
}
