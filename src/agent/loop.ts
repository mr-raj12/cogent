// PHASE 3 — Implement the agent loop
// This is the core of the agent: send messages, handle tool calls, loop until done

import type { AgentEvent, AgentOptions } from "./types.js";
import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from "../types.js";
import { createProvider } from "../providers/index.js";
import { getToolDefinitions, getTool } from "../tools/index.js";

const DEFAULT_MAX_TURNS = 20;

export async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent> {
	// TODO PHASE 3 — Implement the agent loop
	//
	// The agent loop works like this:
	//   1. Send messages to the LLM (which may call tools)
	//   2. If the LLM calls tools, execute them and add results to messages
	//   3. Send messages again with tool results
	//   4. Repeat until the LLM stops calling tools (stop_reason === "end_turn")
	//   5. Emit agent_end with final message list
	//
	// Here's the full implementation guide:
	//
	// Setup:
	//   const provider = createProvider(options.providerName, getApiKey(options.providerName));
	//   const tools = getToolDefinitions();
	//   const messages: Message[] = [...options.messages];
	//   let turns = 0;
	//   const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
	//
	//   yield { type: "agent_start" };
	//
	// Main loop:
	//   while (turns < maxTurns) {
	//     turns++;
	//     const assistantBlocks: ContentBlock[] = [];
	//     let stopReason: StopReason = "end_turn";
	//
	//     // Stream from the LLM
	//     // Track tool calls being built up (they stream in pieces)
	//     const pendingToolCalls: Record<string, { name: string; inputJson: string }> = {};
	//
	//     for await (const event of provider.complete({ model: options.model, system: options.system, messages, tools, max_tokens: 8192 })) {
	//       if (event.type === "text_delta") {
	//         // Accumulate text and yield delta
	//         yield { type: "text_delta", delta: event.delta };
	//         // Add to assistantBlocks (find or create the text block)
	//         const last = assistantBlocks.at(-1);
	//         if (last?.type === "text") last.text += event.delta;
	//         else assistantBlocks.push({ type: "text", text: event.delta });
	//       }
	//
	//       if (event.type === "tool_use_start") {
	//         pendingToolCalls[event.id] = { name: event.name, inputJson: "" };
	//       }
	//
	//       if (event.type === "tool_use_input_delta") {
	//         if (pendingToolCalls[event.id]) pendingToolCalls[event.id]!.inputJson += event.delta;
	//       }
	//
	//       if (event.type === "tool_use_end") {
	//         const tc = pendingToolCalls[event.id]!;
	//         const parsedInput = JSON.parse(tc.inputJson || "{}");
	//         assistantBlocks.push({ type: "tool_use", id: event.id, name: tc.name, input: parsedInput });
	//       }
	//
	//       if (event.type === "message_end") {
	//         stopReason = event.stop_reason;
	//         yield { type: "turn_end", stop_reason: event.stop_reason, usage: event.usage };
	//       }
	//     }
	//
	//     // Add assistant message to history
	//     messages.push({ role: "assistant", content: assistantBlocks });
	//
	//     // If no tool calls, we're done
	//     if (stopReason !== "tool_use") break;
	//
	//     // Execute each tool call and collect results
	//     const toolResultBlocks: ToolResultBlock[] = [];
	//
	//     for (const block of assistantBlocks) {
	//       if (block.type !== "tool_use") continue;
	//       const toolCall = block as ToolUseBlock;
	//
	//       yield { type: "tool_start", id: toolCall.id, name: toolCall.name, input: toolCall.input };
	//
	//       const tool = getTool(toolCall.name);
	//       let result: { output: string; isError: boolean };
	//       if (!tool) {
	//         result = { output: `Unknown tool: ${toolCall.name}`, isError: true };
	//       } else {
	//         result = await tool.execute(toolCall.input).catch(err => ({
	//           output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
	//           isError: true,
	//         }));
	//       }
	//
	//       yield { type: "tool_end", id: toolCall.id, name: toolCall.name, result: result.output, isError: result.isError };
	//
	//       toolResultBlocks.push({
	//         type: "tool_result",
	//         tool_use_id: toolCall.id,
	//         content: result.output,
	//         is_error: result.isError,
	//       });
	//     }
	//
	//     // Add tool results as a user message
	//     messages.push({ role: "user", content: toolResultBlocks });
	//   }
	//
	//   yield { type: "agent_end", messages };

	void options;
	void createProvider;
	void getToolDefinitions;
	void getTool;
	void DEFAULT_MAX_TURNS;
	throw new Error("Agent loop not implemented yet — see comments above");
}

// Helper used inside the loop — gets API key from environment
export function getApiKey(providerName: string): string {
	const envKey = providerName === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY";
	const key = process.env[envKey];
	if (!key) throw new Error(`Missing env var: ${envKey}`);
	return key;
}
