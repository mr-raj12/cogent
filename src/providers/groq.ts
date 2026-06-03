// Groq provider — OpenAI-compatible chat completions with streaming.
// Docs: https://console.groq.com/docs/openai

import { consola } from "consola";
import Groq from "groq-sdk";
import type { ContentBlock } from "../types.js";
import type { CompletionOptions, Provider, StreamEvent } from "./types.js";

// Translate our universal Message[] into OpenAI/Groq chat messages. Tool calls
// live on the assistant message; tool results become separate "tool" messages.
function toGroqMessages(messages: CompletionOptions["messages"]) {
	// biome-ignore lint/complexity/useFlatMap: map().flat() preserves the union return type; flatMap doesn't infer it.
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			if (typeof m.content === "string") {
				return { role: m.role as "user" | "assistant", content: m.content };
			}

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

			const toolResults = m.content.filter(
				(b): b is Extract<ContentBlock, { type: "tool_result" }> => b.type === "tool_result",
			);

			if (toolResults.length > 0) {
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
			const messages = [{ role: "system", content: options.system }, ...toGroqMessages(options.messages)];

			const tools = options.tools.map((t) => ({
				type: "function" as const,
				function: {
					name: t.name,
					description: t.description,
					parameters: t.input_schema,
				},
			}));

			consola.debug(`groq: ${options.model}, ${messages.length} messages, ${tools.length} tools`);

			const stream = await client.chat.completions.create({
				model: options.model,
				messages: messages as any,
				tools: tools.length > 0 ? tools : undefined,
				stream: true,
				max_tokens: options.max_tokens,
				temperature: options.temperature,
			});

			// Groq streams tool-call arguments as fragments, keyed by index.
			const toolCallAccumulator: Record<number, { id: string; name: string; args: string }> = {};
			let finishReason = "end_turn";
			let promptTokens = 0;
			let completionTokens = 0;

			try {
				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (chunk.choices[0]?.finish_reason) {
						finishReason = chunk.choices[0].finish_reason;
					}
					if (chunk.x_groq?.usage) {
						promptTokens = chunk.x_groq.usage.prompt_tokens ?? 0;
						completionTokens = chunk.x_groq.usage.completion_tokens ?? 0;
					}
					if (!delta) continue;

					if (delta.content) {
						yield { type: "text_delta", delta: delta.content };
					}

					for (const tc of delta.tool_calls ?? []) {
						const idx = tc.index;
						if (tc.id) {
							toolCallAccumulator[idx] = { id: tc.id, name: tc.function?.name ?? "", args: "" };
							yield { type: "tool_use_start", id: tc.id, name: tc.function?.name ?? "" };
						}
						if (tc.function?.arguments) {
							toolCallAccumulator[idx]!.args += tc.function.arguments;
							yield { type: "tool_use_input_delta", id: toolCallAccumulator[idx]!.id, delta: tc.function.arguments };
						}
					}
				}
			} catch (err: any) {
				// Llama models sometimes emit tool calls as raw text, which Groq rejects
				// with a 400 whose failed_generation holds the <function=Name {...}</function>
				// markup. Parse it out and synthesize the tool-call events ourselves.
				const failedGen = err?.error?.failed_generation as string | undefined;
				if (err?.status === 400 && failedGen) {
					consola.warn("groq: tool_call serialization failed, parsing failed_generation");
					const regex = /<function=(\w+)\s+(.+?)<\/function>/gs;
					let match = regex.exec(failedGen);
					for (; match !== null; match = regex.exec(failedGen)) {
						const name = match[1]!;
						const argsStr = match[2]!;
						const idx = Object.keys(toolCallAccumulator).length;
						const id = `tc_${name}_${idx}`;
						try {
							JSON.parse(argsStr);
							toolCallAccumulator[idx] = { id, name, args: argsStr };
							yield { type: "tool_use_start", id, name };
							yield { type: "tool_use_input_delta", id, delta: argsStr };
						} catch {
							consola.error(`groq: could not parse args for ${name}: ${argsStr}`);
						}
					}
					finishReason = "tool_calls";
				} else {
					throw err;
				}
			}

			for (const tc of Object.values(toolCallAccumulator)) {
				yield { type: "tool_use_end", id: tc.id };
			}

			yield {
				type: "message_end",
				stop_reason: finishReason === "tool_calls" ? "tool_use" : "end_turn",
				usage: { input_tokens: promptTokens, output_tokens: completionTokens },
			};
		},
	};
}
