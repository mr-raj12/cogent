import { friendlyProviderError } from "../providers/errors.js";
import { createProvider } from "../providers/index.js";
import type { StreamEvent } from "../providers/types.js";
import { getTool, getToolDefinitions } from "../tools/index.js";
import type { ContentBlock, Message, ToolResultBlock, ToolUseBlock } from "../types.js";
import { compactMessages, shouldCompact } from "./compaction.js";
import type { AgentEvent, AgentOptions } from "./types.js";

const DEFAULT_MAX_TURNS = 20;

// Core agent loop: stream a completion, run any tool calls the model requests,
// feed the results back, and repeat until the model stops calling tools.
export async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent> {
	const provider = createProvider(options.providerName, getApiKey(options.providerName));
	const tools = getToolDefinitions();
	let messages: Message[] = [...options.messages];
	let turns = 0;
	const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;

	// Messages produced by this run, in order. Tracked separately from `messages`
	// because compaction rewrites the history, which breaks index-based diffing.
	const newMessages: Message[] = [];

	yield { type: "agent_start" };

	while (turns < maxTurns) {
		turns++;

		// Compact before asking the model, so a long history never overflows the window.
		if (shouldCompact(messages, options.model, options.contextLimit)) {
			const before = messages.length;
			const result = await compactMessages(messages, options.providerName, options.model);
			if (result.compacted) {
				messages = result.messages;
				yield { type: "compacted", summary: result.summary, before, after: messages.length };
			}
		}

		const assistantBlocks: ContentBlock[] = [];

		// Tool calls stream in as fragments keyed by id; assemble them here.
		const pendingToolCalls: Record<string, { name: string; inputJson: string }> = {};

		const stream = streamCompletion(
			provider.complete({
				model: options.model,
				system: options.system,
				messages,
				tools,
				max_tokens: 8192,
			}),
			options.providerName,
			options.model,
		);

		for await (const event of stream) {
			if (event.type === "text_delta") {
				yield { type: "text_delta", delta: event.delta };
				const last = assistantBlocks.at(-1);
				if (last?.type === "text") last.text += event.delta;
				else assistantBlocks.push({ type: "text", text: event.delta });
			}

			if (event.type === "tool_use_start") {
				pendingToolCalls[event.id] = { name: event.name, inputJson: "" };
			}

			if (event.type === "tool_use_input_delta") {
				if (pendingToolCalls[event.id]) pendingToolCalls[event.id]!.inputJson += event.delta;
			}

			if (event.type === "tool_use_end") {
				const tc = pendingToolCalls[event.id]!;
				const parsedInput = JSON.parse(tc.inputJson || "{}");
				assistantBlocks.push({ type: "tool_use", id: event.id, name: tc.name, input: parsedInput });
			}

			if (event.type === "message_end") {
				yield { type: "turn_end", stop_reason: event.stop_reason, usage: event.usage };
			}
		}

		const assistantMessage: Message = { role: "assistant", content: assistantBlocks };
		messages.push(assistantMessage);
		newMessages.push(assistantMessage);

		// Gemini reports "end_turn" even when it calls tools, so decide based on the
		// blocks we actually received rather than on the stop reason.
		const hasToolCalls = assistantBlocks.some((b) => b.type === "tool_use");
		if (!hasToolCalls) break;

		const toolResultBlocks: ToolResultBlock[] = [];

		for (const block of assistantBlocks) {
			if (block.type !== "tool_use") continue;
			const toolCall = block as ToolUseBlock;

			yield { type: "tool_start", id: toolCall.id, name: toolCall.name, input: toolCall.input };

			const result = await runToolCall(toolCall, options);

			if (result.denied) {
				yield { type: "tool_denied", id: toolCall.id, name: toolCall.name, reason: result.output };
			}
			yield { type: "tool_end", id: toolCall.id, name: toolCall.name, result: result.output, isError: result.isError };

			toolResultBlocks.push({
				type: "tool_result",
				tool_use_id: toolCall.id,
				content: result.output,
				is_error: result.isError,
			});
		}

		const toolResultMessage: Message = { role: "user", content: toolResultBlocks };
		messages.push(toolResultMessage);
		newMessages.push(toolResultMessage);
	}

	yield { type: "agent_end", messages, newMessages };
}

// Pass provider events straight through, but translate a thrown SDK blob into
// something a person can act on.
async function* streamCompletion(
	source: AsyncGenerator<StreamEvent>,
	providerName: string,
	model: string,
): AsyncGenerator<StreamEvent> {
	try {
		yield* source;
	} catch (err) {
		throw new Error(friendlyProviderError(err, providerName, model));
	}
}

interface ToolCallOutcome {
	output: string;
	isError: boolean;
	denied?: boolean;
}

// Resolve one tool call: look it up, clear it with the permission gate, run it.
// A denial comes back as an error result so the model can adapt rather than the
// run dying.
async function runToolCall(toolCall: ToolUseBlock, options: AgentOptions): Promise<ToolCallOutcome> {
	const tool = getTool(toolCall.name);
	if (!tool) return { output: `Unknown tool: ${toolCall.name}`, isError: true };

	// Read-only tools observe without changing anything, so they never prompt.
	if (!tool.readOnly && options.canUseTool) {
		const decision = await options.canUseTool(toolCall.name, toolCall.input);
		if (decision.behavior === "deny") {
			return { output: decision.message, isError: true, denied: true };
		}
	}

	return tool.execute(toolCall.input).catch((err) => ({
		output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
		isError: true,
	}));
}

const API_KEY_ENV: Record<string, string> = {
	anthropic: "ANTHROPIC_API_KEY",
	gemini: "GEMINI_API_KEY",
	groq: "GROQ_API_KEY",
};

export function getApiKey(providerName: string): string {
	const envVar = API_KEY_ENV[providerName];
	if (!envVar) throw new Error(`Unknown provider: ${providerName}`);

	const key = process.env[envVar];
	if (!key) throw new Error(`Missing env var: ${envVar} (needed for ${providerName})`);
	return key;
}
