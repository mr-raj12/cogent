// PHASE 9 — Implement context compaction
// When token count gets high, summarize old messages to free up context space

import type { Message } from "../types.js";
import { getModelInfo } from "../providers/index.js";
import { createProvider, getDefaultModel } from "../providers/index.js";
import { getApiKey } from "./loop.js";

// Rough token estimator: ~4 chars per token (good enough for threshold checks)
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

// Returns true if we should compact (>75% of context window used)
export function shouldCompact(messages: Message[], model: string, providerName: string): boolean {
	// TODO PHASE 9 — Check if compaction is needed
	//
	// 1. Get model info:
	//    const info = getModelInfo(model);
	//    if (!info) return false;
	//
	// 2. Estimate current token usage:
	//    const estimated = estimateTokens(messages);
	//
	// 3. Return true if over threshold (75%):
	//    return estimated > info.contextWindow * 0.75;

	void messages;
	void model;
	void providerName;
	void getModelInfo;
	return false;
}

export async function compactMessages(
	messages: Message[],
	system: string,
	providerName: string,
	model: string,
): Promise<Message[]> {
	// TODO PHASE 9 — Summarize old messages and return a shorter history
	//
	// Strategy: keep the last few messages verbatim, summarize everything before.
	//
	// 1. Keep the last 6 messages (3 turns) untouched:
	//    const KEEP_RECENT = 6;
	//    const toSummarize = messages.slice(0, -KEEP_RECENT);
	//    const recent = messages.slice(-KEEP_RECENT);
	//
	// 2. Build a summary prompt:
	//    const summaryPrompt = `Summarize the following conversation history concisely.
	//    Focus on: what was accomplished, what files were changed, important decisions.
	//    Be brief — 3-5 sentences max.
	//
	//    HISTORY:
	//    ${toSummarize.map(m => `${m.role}: ${typeof m.content === "string" ? m.content : "[tool calls/results]"}`).join("\n")}`;
	//
	// 3. Get summary from the LLM (use a small/fast model if possible):
	//    const provider = createProvider(providerName, getApiKey(providerName));
	//    let summary = "";
	//    for await (const event of provider.complete({
	//      model,
	//      system: "You are a helpful assistant. Summarize concisely.",
	//      messages: [{ role: "user", content: summaryPrompt }],
	//      tools: [],
	//      max_tokens: 500,
	//    })) {
	//      if (event.type === "text_delta") summary += event.delta;
	//    }
	//
	// 4. Return compacted history:
	//    const summaryMessage: Message = {
	//      role: "user",
	//      content: `[Previous conversation summary]: ${summary}`,
	//    };
	//    return [summaryMessage, ...recent];

	void messages;
	void system;
	void providerName;
	void model;
	void createProvider;
	void getApiKey;
	void getDefaultModel;
	return messages; // no-op until implemented
}
