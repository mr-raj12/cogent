// Global and per-project settings shape
export interface Settings {
	provider?: string; // "gemini" | "groq"
	model?: string; // e.g. "gemini-2.5-flash"
	maxTokens?: number; // default 8192
	temperature?: number; // default 1.0
	systemPromptExtra?: string; // appended to the base system prompt
}
