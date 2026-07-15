import { Box, Text } from "ink";
import { getContextLimit } from "../agent/compaction.js";
import { Markdown } from "./markdown.js";
import { theme } from "./theme.js";
import type { Item, PendingPermission, Tone } from "./types.js";

export function Banner({ provider, model, session }: { provider: string; model: string; session: string }) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={theme.accent} bold>
					{"  ▄▖▄▖▄▖▄▖▖▖▄▖\n  ▌ ▌▌▌ ▛▖▛▖▌ ▐ \n  ▙▖▙▌▙▖▙▌▙▌▙▖▐ "}
				</Text>
			</Box>
			<Box marginTop={1}>
				<Text color={theme.muted}>
					{"  "}
					{provider}/{model} · session {session.slice(0, 8)}
				</Text>
			</Box>
			<Box>
				<Text color={theme.muted}>{"  "}/help for commands · /exit to quit</Text>
			</Box>
		</Box>
	);
}

function UserRow({ text }: { text: string }) {
	return (
		<Box marginTop={1}>
			<Text color={theme.accent} bold>
				{"› "}
			</Text>
			<Text color={theme.user}>{text}</Text>
		</Box>
	);
}

function AssistantRow({ text }: { text: string }) {
	return (
		<Box marginTop={1} paddingLeft={2}>
			<Markdown text={text} />
		</Box>
	);
}

function NoticeRow({ tone, text }: { tone: Tone; text: string }) {
	const color =
		tone === "error" ? theme.error : tone === "warn" ? theme.warn : tone === "success" ? theme.success : theme.muted;
	return (
		<Box marginTop={1} paddingLeft={2}>
			<Text color={color}>{text}</Text>
		</Box>
	);
}

// Tool calls are the densest thing on screen, so they get a compact two-line
// shape: what was run, then a clipped result.
function ToolRow({ item }: { item: Extract<Item, { kind: "tool" }> }) {
	const mark = item.denied || item.isError ? "✗" : "✓";
	const markColor = item.denied || item.isError ? theme.error : theme.success;

	return (
		<Box flexDirection="column" marginTop={1} paddingLeft={2}>
			<Box>
				<Text color={theme.tool}>⏺ </Text>
				<Text color={theme.tool} bold>
					{item.name}
				</Text>
				<Text color={theme.muted}>{item.summary ? `  ${item.summary}` : ""}</Text>
			</Box>
			<Box paddingLeft={2}>
				<Text color={markColor}>{mark} </Text>
				<Text color={theme.muted}>{previewResult(item.result)}</Text>
			</Box>
		</Box>
	);
}

// Tool output is for glancing at, not reading: one clean line plus a count. The
// Read tool numbers its lines, so strip that gutter or the preview reads
// "1 import type …" and the leading 1 looks like part of the file.
function previewResult(result: string): string {
	const lines = result.split("\n");
	const first = (lines.find((l) => l.trim()) ?? "").replace(/^\s*\d+\t/, "").trim();
	const rest = lines.length - 1;
	const clipped = first.length > 90 ? `${first.slice(0, 90)}…` : first;
	return rest > 0 ? `${clipped}  +${rest} lines` : clipped;
}

export function TranscriptRow({ item }: { item: Item }) {
	switch (item.kind) {
		case "user":
			return <UserRow text={item.text} />;
		case "assistant":
			return <AssistantRow text={item.text} />;
		case "tool":
			return <ToolRow item={item} />;
		case "notice":
			return <NoticeRow tone={item.tone} text={item.text} />;
	}
}

export function Spinner({ frame, label }: { frame: string; label: string }) {
	return (
		<Box marginTop={1} paddingLeft={2}>
			<Text color={theme.accent}>{frame} </Text>
			<Text color={theme.muted}>{label}</Text>
		</Box>
	);
}

const CHOICES = [
	{ key: "yes", label: "Yes, run it once" },
	{ key: "always", label: "Yes, and don't ask again for this tool" },
	{ key: "no", label: "No, tell the model to stop" },
] as const;

export function PermissionDialog({ pending, selected }: { pending: PendingPermission; selected: number }) {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor={theme.warn} paddingX={1} marginTop={1}>
			<Text color={theme.warn} bold>
				{pending.name} wants to run
			</Text>
			<Box marginBottom={1}>
				<Text color={theme.assistant}>{pending.summary}</Text>
			</Box>
			{CHOICES.map((choice, i) => (
				<Text key={choice.key} color={i === selected ? theme.accent : theme.muted}>
					{i === selected ? "❯ " : "  "}
					{choice.label}
				</Text>
			))}
			<Box marginTop={1}>
				<Text color={theme.muted}>↑↓ to move · enter to confirm · esc to deny</Text>
			</Box>
		</Box>
	);
}

export function InputBox({ value, focused }: { value: string; focused: boolean }) {
	return (
		<Box borderStyle="round" borderColor={focused ? theme.accent : theme.muted} paddingX={1}>
			<Text color={theme.accent}>{"› "}</Text>
			<Text>{value}</Text>
			{focused ? <Text color={theme.accent}>▏</Text> : null}
		</Box>
	);
}

export function StatusBar({
	provider,
	model,
	usedTokens,
	contextLimit,
	hint,
}: {
	provider: string;
	model: string;
	usedTokens: number;
	contextLimit?: number;
	hint: string;
}) {
	const limit = getContextLimit(model, contextLimit);
	const pct = limit ? Math.round((usedTokens / limit) * 100) : 0;
	const pctColor = pct > 75 ? theme.error : pct > 50 ? theme.warn : theme.muted;

	return (
		<Box paddingX={1}>
			<Text color={theme.muted}>
				{provider}/{model}
			</Text>
			{limit ? (
				<>
					<Text color={theme.muted}>{" · "}</Text>
					<Text color={pctColor}>context {pct}%</Text>
				</>
			) : null}
			<Text color={theme.muted}>{" · "}</Text>
			<Text color={theme.muted}>{hint}</Text>
		</Box>
	);
}
