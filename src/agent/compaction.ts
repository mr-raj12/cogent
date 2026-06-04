// Context compaction: when a conversation approaches the model's context
// window, summarize the older messages so the agent can keep going.

import { createProvider, getModelInfo } from "../providers/index.js";
import type { Message } from "../types.js";
import { getApiKey } from "./loop.js";

const KEEP_RECENT = 6; // messages left untouched (roughly the last 3 turns)
const COMPACT_THRESHOLD = 0.75; // fraction of the context window before compacting

// Rough token estimate at ~4 characters per token — good enough for a threshold.
export function estimateTokens(messages: Message[]): number {
	let chars = 0;
	for (const msg of messages) {
		if (typeof msg.content === "string") {
			chars += msg.content.length;
		} else {
			for (const block of msg.content) {
				if (block.type === "text") chars += block.text.length;
				if (block.type === "tool_result") chars += block.content.length;
			}
		}
	}
	return Math.ceil(chars / 4);
}

export function shouldCompact(messages: Message[], model: string): boolean {
	const info = getModelInfo(model);
	if (!info) return false;
	return estimateTokens(messages) > info.contextWindow * COMPACT_THRESHOLD;
}

export async function compactMessages(messages: Message[], providerName: string, model: string): Promise<Message[]> {
	if (messages.length <= KEEP_RECENT) return messages;

	const toSummarize = messages.slice(0, -KEEP_RECENT);
	const recent = messages.slice(-KEEP_RECENT);

	const history = toSummarize
		.map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : "[tool calls/results]"}`)
		.join("\n");

	const summaryPrompt =
		`Summarize the following conversation history concisely. Focus on what was ` +
		`accomplished, which files changed, and any important decisions. Keep it to ` +
		`a few sentences.\n\nHISTORY:\n${history}`;

	const provider = createProvider(providerName, getApiKey(providerName));
	let summary = "";
	for await (const event of provider.complete({
		model,
		system: "You summarize conversations concisely.",
		messages: [{ role: "user", content: summaryPrompt }],
		tools: [],
		max_tokens: 500,
	})) {
		if (event.type === "text_delta") summary += event.delta;
	}

	const summaryMessage: Message = {
		role: "user",
		content: `[Previous conversation summary]: ${summary}`,
	};
	return [summaryMessage, ...recent];
}
