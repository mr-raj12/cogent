// Anthropic provider — wraps @anthropic-ai/sdk and adapts it to our streaming
// Provider interface. Docs: https://platform.claude.com/docs
//
// This is the thinnest of the three adapters: our internal content-block model
// (text / tool_use / tool_result) is modelled on Anthropic's, so messages pass
// through almost unchanged. The real work is flattening Anthropic's
// index-keyed stream events onto our id-keyed ones.

import Anthropic from "@anthropic-ai/sdk";
import { consola } from "consola";
import type { ContentBlock, StopReason } from "../types.js";
import type { CompletionOptions, Provider, StreamEvent } from "./types.js";

// Anthropic reports stop reasons we don't model (pause_turn, refusal,
// model_context_window_exceeded). The agent loop decides whether to continue
// from the blocks it received, so anything unmapped settles on end_turn.
function toStopReason(reason: string | null): StopReason {
	switch (reason) {
		case "tool_use":
		case "max_tokens":
		case "stop_sequence":
		case "end_turn":
			return reason;
		default:
			return "end_turn";
	}
}

// Our Message[] is already Anthropic-shaped; system turns are dropped because
// Anthropic takes the system prompt as its own top-level parameter.
function toAnthropicMessages(messages: CompletionOptions["messages"]): Anthropic.MessageParam[] {
	return messages
		.filter((m) => m.role !== "system")
		.map((m) => {
			const role = m.role === "assistant" ? "assistant" : "user";

			if (typeof m.content === "string") {
				return { role, content: m.content };
			}

			const blocks = m.content.map((block: ContentBlock) => {
				if (block.type === "text") {
					return { type: "text" as const, text: block.text };
				}
				if (block.type === "tool_use") {
					return { type: "tool_use" as const, id: block.id, name: block.name, input: block.input };
				}
				return {
					type: "tool_result" as const,
					tool_use_id: block.tool_use_id,
					content: block.content,
					is_error: block.is_error ?? false,
				};
			});

			return { role, content: blocks };
		});
}

export function createAnthropicProvider(apiKey: string): Provider {
	const client = new Anthropic({ apiKey });

	return {
		name: "anthropic",

		async *complete(options: CompletionOptions): AsyncGenerator<StreamEvent> {
			const messages = toAnthropicMessages(options.messages);
			consola.debug(`anthropic: ${options.model}, ${messages.length} turns, ${options.tools.length} tools`);

			const stream = client.messages.stream({
				model: options.model,
				max_tokens: options.max_tokens,
				system: options.system,
				messages,
				tools: options.tools.map((t) => ({
					name: t.name,
					description: t.description,
					input_schema: t.input_schema as Anthropic.Tool.InputSchema,
				})),
				// Sonnet 5 runs adaptive thinking when this is omitted. Our content-block
				// model has no thinking channel, and thinking shares the max_tokens budget
				// with the answer, so keep it off for parity with the other providers.
				thinking: { type: "disabled" },
			});

			// Anthropic keys stream deltas by block index; our events are keyed by
			// tool-use id, so remember which index belongs to which call.
			const toolIdByIndex = new Map<number, string>();
			let inputTokens = 0;
			let outputTokens = 0;
			let stopReason: StopReason = "end_turn";

			for await (const event of stream) {
				if (event.type === "message_start") {
					inputTokens = event.message.usage.input_tokens;
					outputTokens = event.message.usage.output_tokens;
				}

				if (event.type === "content_block_start") {
					if (event.content_block.type === "tool_use") {
						toolIdByIndex.set(event.index, event.content_block.id);
						yield { type: "tool_use_start", id: event.content_block.id, name: event.content_block.name };
					}
				}

				if (event.type === "content_block_delta") {
					if (event.delta.type === "text_delta") {
						yield { type: "text_delta", delta: event.delta.text };
					}
					if (event.delta.type === "input_json_delta") {
						const id = toolIdByIndex.get(event.index);
						if (id) yield { type: "tool_use_input_delta", id, delta: event.delta.partial_json };
					}
				}

				if (event.type === "content_block_stop") {
					const id = toolIdByIndex.get(event.index);
					if (id) yield { type: "tool_use_end", id };
				}

				if (event.type === "message_delta") {
					stopReason = toStopReason(event.delta.stop_reason);
					outputTokens = event.usage.output_tokens;
				}
			}

			yield {
				type: "message_end",
				stop_reason: stopReason,
				usage: { input_tokens: inputTokens, output_tokens: outputTokens },
			};
		},
	};
}
