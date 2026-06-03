import { createProvider } from "../providers/index.js";
import { getTool, getToolDefinitions } from "../tools/index.js";
import type { ContentBlock, Message, ToolResultBlock, ToolUseBlock } from "../types.js";
import type { AgentEvent, AgentOptions } from "./types.js";

const DEFAULT_MAX_TURNS = 20;

// Core agent loop: stream a completion, run any tool calls the model requests,
// feed the results back, and repeat until the model stops calling tools.
export async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent> {
	const provider = createProvider(options.providerName, getApiKey(options.providerName));
	const tools = getToolDefinitions();
	const messages: Message[] = [...options.messages];
	let turns = 0;
	const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;

	yield { type: "agent_start" };

	while (turns < maxTurns) {
		turns++;
		const assistantBlocks: ContentBlock[] = [];

		// Tool calls stream in as fragments keyed by id; assemble them here.
		const pendingToolCalls: Record<string, { name: string; inputJson: string }> = {};

		for await (const event of provider.complete({
			model: options.model,
			system: options.system,
			messages,
			tools,
			max_tokens: 8192,
		})) {
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

		messages.push({ role: "assistant", content: assistantBlocks });

		// Gemini reports "end_turn" even when it calls tools, so decide based on the
		// blocks we actually received rather than on the stop reason.
		const hasToolCalls = assistantBlocks.some((b) => b.type === "tool_use");
		if (!hasToolCalls) break;

		const toolResultBlocks: ToolResultBlock[] = [];

		for (const block of assistantBlocks) {
			if (block.type !== "tool_use") continue;
			const toolCall = block as ToolUseBlock;

			yield { type: "tool_start", id: toolCall.id, name: toolCall.name, input: toolCall.input };

			const tool = getTool(toolCall.name);
			let result: { output: string; isError: boolean };
			if (!tool) {
				result = { output: `Unknown tool: ${toolCall.name}`, isError: true };
			} else {
				result = await tool.execute(toolCall.input).catch((err) => ({
					output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				}));
			}

			yield { type: "tool_end", id: toolCall.id, name: toolCall.name, result: result.output, isError: result.isError };

			toolResultBlocks.push({
				type: "tool_result",
				tool_use_id: toolCall.id,
				content: result.output,
				is_error: result.isError,
			});
		}

		messages.push({ role: "user", content: toolResultBlocks });
	}

	yield { type: "agent_end", messages };
}

export function getApiKey(providerName: string): string {
	const envKey = providerName === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY";
	const key = process.env[envKey];
	if (!key) throw new Error(`Missing env var: ${envKey}`);
	return key;
}
