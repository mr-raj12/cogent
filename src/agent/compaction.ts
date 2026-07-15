// Context compaction: when a conversation approaches the model's context
// window, summarize the older messages so the agent can keep going.

import { friendlyProviderError } from "../providers/errors.js";
import { createProvider, getModelInfo } from "../providers/index.js";
import type { Message } from "../types.js";
import { getApiKey } from "./loop.js";

const KEEP_RECENT = 6; // messages left untouched (roughly the last 3 turns)
const COMPACT_THRESHOLD = 0.75; // fraction of the context window before compacting

export interface CompactionResult {
	messages: Message[];
	summary: string;
	originalCount: number;
	compacted: boolean;
}

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

// The effective context budget: an explicit override (--context-limit) wins,
// otherwise the model's real window.
export function getContextLimit(model: string, override?: number): number | undefined {
	if (override && override > 0) return override;
	return getModelInfo(model)?.contextWindow;
}

export function shouldCompact(messages: Message[], model: string, contextLimit?: number): boolean {
	const limit = getContextLimit(model, contextLimit);
	if (!limit) return false;
	return estimateTokens(messages) > limit * COMPACT_THRESHOLD;
}

// A user message carrying tool_result blocks only makes sense directly after the
// assistant message whose tool_use it answers. Walk the split point backwards
// until it no longer lands on such an orphan, or the API will reject the history.
function findSafeSplit(messages: Message[], keepRecent: number): number {
	let index = Math.max(0, messages.length - keepRecent);
	while (index > 0) {
		const msg = messages[index]!;
		const isToolResult =
			msg.role === "user" && Array.isArray(msg.content) && msg.content.some((b) => b.type === "tool_result");
		if (!isToolResult) break;
		index--;
	}
	return index;
}

// Render a message for the summarizer, including tool names so the summary can
// say what the agent actually did rather than "[tool calls/results]".
function renderForSummary(msg: Message): string {
	if (typeof msg.content === "string") return `${msg.role}: ${msg.content}`;

	const parts: string[] = [];
	for (const block of msg.content) {
		if (block.type === "text") parts.push(block.text);
		if (block.type === "tool_use") {
			parts.push(`[called ${block.name} with ${JSON.stringify(block.input).slice(0, 200)}]`);
		}
		if (block.type === "tool_result") parts.push(`[result: ${block.content.slice(0, 200)}]`);
	}
	return `${msg.role}: ${parts.join(" ")}`;
}

export async function compactMessages(
	messages: Message[],
	providerName: string,
	model: string,
): Promise<CompactionResult> {
	const unchanged = (): CompactionResult => ({
		messages,
		summary: "",
		originalCount: messages.length,
		compacted: false,
	});

	const split = findSafeSplit(messages, KEEP_RECENT);
	if (split <= 0) return unchanged();

	const toSummarize = messages.slice(0, split);
	const recent = messages.slice(split);

	const history = toSummarize.map(renderForSummary).join("\n");

	const summaryPrompt =
		`Summarize the following conversation history concisely. Focus on what was ` +
		`accomplished, which files were read or changed, and any decisions or ` +
		`constraints that later turns will need. Keep it to a few sentences.\n\n` +
		`HISTORY:\n${history}`;

	const provider = createProvider(providerName, getApiKey(providerName));
	let summary = "";
	try {
		for await (const event of provider.complete({
			model,
			system: "You summarize conversations concisely.",
			messages: [{ role: "user", content: summaryPrompt }],
			tools: [],
			max_tokens: 500,
		})) {
			if (event.type === "text_delta") summary += event.delta;
		}
	} catch (err) {
		throw new Error(friendlyProviderError(err, providerName, model));
	}

	summary = summary.trim();
	if (!summary) return unchanged();

	const summaryMessage: Message = {
		role: "user",
		content: `[Previous conversation summary]: ${summary}`,
	};

	return {
		messages: [summaryMessage, ...recent],
		summary,
		originalCount: messages.length,
		compacted: true,
	};
}
