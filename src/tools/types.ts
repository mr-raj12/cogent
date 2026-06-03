// What a tool returns after execution
export interface ToolResult {
	output: string; // text sent back to the LLM
	isError: boolean;
}

// Every tool implements this interface
export interface Tool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>; // JSON Schema — tells the LLM what fields to pass
	execute(input: Record<string, unknown>): Promise<ToolResult>;
}

// Helper: wrap a caught error as a ToolResult
export function errorResult(err: unknown): ToolResult {
	const msg = err instanceof Error ? err.message : String(err);
	return { output: `Error: ${msg}`, isError: true };
}

// Helper: wrap plain text as a success ToolResult
export function okResult(output: string): ToolResult {
	return { output, isError: false };
}
