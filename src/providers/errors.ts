// Provider SDKs surface failures as deeply nested JSON blobs. Nobody can read
// those in a terminal, so reduce the common ones to a single actionable line.

function apiKeyEnvVar(providerName: string): string {
	return `${providerName.toUpperCase()}_API_KEY`;
}

export function friendlyProviderError(err: unknown, providerName: string, model: string): string {
	const raw = err instanceof Error ? err.message : String(err);
	const status = extractStatus(raw);

	if (status === 401 || status === 403 || /invalid[_ ]api[_ ]key|API key not valid|authentication_error/i.test(raw)) {
		return `${providerName} rejected the API key. Check ${apiKeyEnvVar(providerName)}.`;
	}

	if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(raw)) {
		const retry = raw.match(/retry in ([\d.]+)s/i)?.[1];
		const when = retry ? ` Retry in ~${Math.ceil(Number(retry))}s.` : "";
		return `${providerName} rate-limited or out of quota for ${model}.${when} Try another model with --model, or /model in the REPL.`;
	}

	if (status === 404 || /not found|does not exist/i.test(raw)) {
		return `${providerName} does not recognize the model "${model}". Run --list-models.`;
	}

	if (status && status >= 500) {
		return `${providerName} had a server error (${status}). Worth retrying.`;
	}

	// Unknown shape: return the first meaningful line rather than the whole blob.
	return firstMessage(raw) ?? raw.slice(0, 300);
}

function extractStatus(raw: string): number | undefined {
	const match = raw.match(/"code"\s*:\s*(\d{3})|"status"\s*:\s*(\d{3})|\b(4\d{2}|5\d{2})\b/);
	if (!match) return undefined;
	const found = match[1] ?? match[2] ?? match[3];
	return found ? Number(found) : undefined;
}

// Dig the innermost "message" out of nested JSON error envelopes.
function firstMessage(raw: string): string | undefined {
	const matches = [...raw.matchAll(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
	if (matches.length === 0) return undefined;

	const messages = matches
		.map((m) => m[1]!.replace(/\\n/g, " ").replace(/\\"/g, '"').trim())
		.filter((m) => m.length > 0 && !m.startsWith("{"));

	if (messages.length === 0) return undefined;
	// The innermost message is the specific one.
	return messages[messages.length - 1]!.split(". ")[0]!.slice(0, 300);
}
