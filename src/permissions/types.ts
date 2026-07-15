// Tool permissions: before the agent loop runs a tool that can change the world,
// it asks for a decision. The REPL answers by prompting the user; print mode and
// tests answer with a fixed policy.

export type PermissionDecision = { behavior: "allow" } | { behavior: "deny"; message: string };

// Asked once per tool call. Returning "deny" feeds the message back to the model
// as the tool result, so it can react rather than crash.
export type CanUseTool = (name: string, input: Record<string, unknown>) => Promise<PermissionDecision>;

export const allowAll: CanUseTool = async () => ({ behavior: "allow" });

export const denyAll: CanUseTool = async (name) => ({
	behavior: "deny",
	message: `Permission to run ${name} was denied by policy.`,
});
