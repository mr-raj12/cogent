import { createGeminiProvider } from "./gemini.js";
import { createGroqProvider } from "./groq.js";
import type { ModelInfo, Provider } from "./types.js";

// All supported models — add more here as needed
export const MODELS: ModelInfo[] = [
	// Gemini
	{
		id: "gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		provider: "gemini",
		contextWindow: 1_048_576,
		maxOutputTokens: 65536,
	},
	{
		id: "gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		provider: "gemini",
		contextWindow: 1_048_576,
		maxOutputTokens: 65536,
	},
	{
		id: "gemini-2.0-flash",
		name: "Gemini 2.0 Flash",
		provider: "gemini",
		contextWindow: 1_048_576,
		maxOutputTokens: 8192,
	},
	// Groq
	{
		id: "llama-3.3-70b-versatile",
		name: "Llama 3.3 70B",
		provider: "groq",
		contextWindow: 128_000,
		maxOutputTokens: 32768,
	},
	{
		id: "llama-3.1-8b-instant",
		name: "Llama 3.1 8B Instant",
		provider: "groq",
		contextWindow: 128_000,
		maxOutputTokens: 8192,
	},
	{
		id: "deepseek-r1-distill-llama-70b",
		name: "DeepSeek R1 Distill 70B",
		provider: "groq",
		contextWindow: 128_000,
		maxOutputTokens: 16384,
	},
	{ id: "qwen-qwq-32b", name: "Qwen QwQ 32B", provider: "groq", contextWindow: 128_000, maxOutputTokens: 16384 },
	{
		id: "moonshotai/kimi-k2-instruct",
		name: "Kimi K2 Instruct",
		provider: "groq",
		contextWindow: 131_072,
		maxOutputTokens: 16384,
	},
];

export function createProvider(providerName: string, apiKey: string): Provider {
	switch (providerName) {
		case "gemini":
			return createGeminiProvider(apiKey);
		case "groq":
			return createGroqProvider(apiKey);
		default:
			throw new Error(`Unknown provider: "${providerName}". Available: gemini, groq`);
	}
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
	return MODELS.find((m) => m.id === modelId);
}

export function getProviderModels(providerName: string): ModelInfo[] {
	return MODELS.filter((m) => m.provider === providerName);
}

export function getDefaultModel(providerName: string): string {
	const models = getProviderModels(providerName);
	if (models.length === 0) throw new Error(`No models for provider: ${providerName}`);
	return models[0]!.id;
}
