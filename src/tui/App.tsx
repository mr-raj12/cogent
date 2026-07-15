import { Box, Static, Text, useApp, useInput, useStdin } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { estimateTokens } from "../agent/compaction.js";
import { runAgent } from "../agent/loop.js";
import type { CanUseTool, PermissionDecision } from "../permissions/types.js";
import { saveCompaction, saveMessage, saveMessages } from "../session/manager.js";
import type { Message } from "../types.js";
import { describeTool, runTuiCommand } from "./commands.js";
import { InputBox, PermissionDialog, Spinner, StatusBar, TranscriptRow } from "./components.js";
import { Markdown } from "./markdown.js";
import { SPINNER, theme } from "./theme.js";
import type { DraftItem, Item, PendingPermission, Tone } from "./types.js";

export interface AppProps {
	providerName: string;
	model: string;
	system: string;
	sessionId: string;
	initialMessages: Message[];
	contextLimit?: number;
	yolo: boolean;
}

export function App(props: AppProps) {
	const { exit } = useApp();
	const { isRawModeSupported } = useStdin();

	const [items, setItems] = useState<Item[]>([]);
	const [input, setInput] = useState("");
	const [streaming, setStreaming] = useState("");
	const [busy, setBusy] = useState(false);
	const [frame, setFrame] = useState(0);
	const [pending, setPending] = useState<PendingPermission | null>(null);
	const [activeTool, setActiveTool] = useState<{ name: string; summary: string } | null>(null);
	const [choice, setChoice] = useState(0);
	const [model, setModel] = useState(props.model);
	const [providerName, setProviderName] = useState(props.providerName);
	const [tokens, setTokens] = useState(estimateTokens(props.initialMessages));

	// History lives in a ref: the agent loop reads it across awaits, and we never
	// want a stale closure to resurrect an old transcript.
	const messages = useRef<Message[]>([...props.initialMessages]);
	const nextId = useRef(0);
	const alwaysAllowed = useRef(new Set<string>());

	const push = useCallback((item: DraftItem) => {
		setItems((prev) => [...prev, { ...item, id: nextId.current++ }]);
	}, []);

	const notice = useCallback((text: string, tone: Tone = "info") => push({ kind: "notice", tone, text }), [push]);

	// Spinner ticks only while the agent is working.
	useEffect(() => {
		if (!busy) return;
		const timer = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80);
		return () => clearInterval(timer);
	}, [busy]);

	useEffect(() => {
		if (props.initialMessages.length > 0) {
			notice(`Resumed session — ${props.initialMessages.length} messages restored.`, "success");
		}
		if (props.yolo) notice("Permission prompts are off (--yolo). Tools run unattended.", "warn");
	}, [notice, props.initialMessages.length, props.yolo]);

	// Bridge the loop's permission gate to the dialog: park a promise here and
	// let the keyboard handler resolve it.
	const canUseTool: CanUseTool = useCallback(
		async (name, toolInput): Promise<PermissionDecision> => {
			if (props.yolo || alwaysAllowed.current.has(name)) return { behavior: "allow" };

			const answer = await new Promise<"yes" | "always" | "no">((resolve) => {
				setChoice(0);
				setPending({ name, summary: describeTool(name, toolInput), resolve });
			});
			setPending(null);

			if (answer === "always") alwaysAllowed.current.add(name);
			if (answer === "no") {
				return {
					behavior: "deny",
					message: `The user denied permission to run ${name}. Do not retry this call; ask what they'd like instead.`,
				};
			}
			return { behavior: "allow" };
		},
		[props.yolo],
	);

	const runTurn = useCallback(
		async (text: string) => {
			const userMessage: Message = { role: "user", content: text };
			messages.current.push(userMessage);
			await saveMessage(props.sessionId, userMessage);

			setBusy(true);
			let buffer = "";
			// tool_end carries no input and tool_denied precedes it, so carry both
			// forward from the start event keyed by tool-use id.
			const summaryByToolId = new Map<string, string>();
			const deniedIds = new Set<string>();

			try {
				for await (const event of runAgent({
					providerName,
					model,
					system: props.system,
					messages: messages.current,
					contextLimit: props.contextLimit,
					canUseTool,
				})) {
					switch (event.type) {
						case "text_delta":
							buffer += event.delta;
							setStreaming(buffer);
							break;

						case "tool_start": {
							// Flush any prose the model wrote before reaching for the tool.
							if (buffer.trim()) push({ kind: "assistant", text: buffer.trim() });
							buffer = "";
							setStreaming("");

							// A running tool goes in the live area, not the transcript: <Static>
							// renders each item once and never re-renders it, so a row parked
							// there could never be updated with its result.
							const summary = describeTool(event.name, event.input);
							summaryByToolId.set(event.id, summary);
							setActiveTool({ name: event.name, summary });
							break;
						}

						case "tool_denied":
							deniedIds.add(event.id);
							break;

						case "tool_end": {
							// The call has settled, so it can be committed to the transcript.
							setActiveTool(null);
							push({
								kind: "tool",
								name: event.name,
								summary: summaryByToolId.get(event.id) ?? "",
								result: event.result.trim() || "(no output)",
								isError: event.isError,
								denied: deniedIds.has(event.id),
							});
							break;
						}

						case "compacted":
							notice(`Auto-compacted context: ${event.before} → ${event.after} messages.`, "warn");
							await saveCompaction(props.sessionId, event.summary, event.before);
							break;

						case "agent_end":
							messages.current = event.messages;
							await saveMessages(props.sessionId, event.newMessages);
							setTokens(estimateTokens(event.messages));
							break;
					}
				}

				if (buffer.trim()) push({ kind: "assistant", text: buffer.trim() });
			} catch (err) {
				notice(err instanceof Error ? err.message : String(err), "error");
				// Drop the turn that failed so the history stays consistent.
				messages.current = messages.current.filter((m) => m !== userMessage);
			} finally {
				setStreaming("");
				setActiveTool(null);
				setBusy(false);
			}
		},
		[canUseTool, model, notice, props.contextLimit, props.sessionId, props.system, providerName, push],
	);

	const submit = useCallback(
		async (raw: string) => {
			const text = raw.trim();
			if (!text) return;
			setInput("");

			if (text.startsWith("/")) {
				push({ kind: "user", text });
				const result = await runTuiCommand(text, {
					providerName,
					model,
					messages: messages.current,
					sessionId: props.sessionId,
					contextLimit: props.contextLimit,
					setModel,
					setProviderName,
					setMessages: (next) => {
						messages.current = next;
						setTokens(estimateTokens(next));
					},
					notice,
				});
				if (result.exit) exit();
				if (result.clearScreen) setItems([]);
				return;
			}

			push({ kind: "user", text });
			await runTurn(text);
		},
		[exit, model, notice, props.contextLimit, props.sessionId, providerName, push, runTurn],
	);

	useInput((char, key) => {
		// The permission dialog owns the keyboard while it's up.
		if (pending) {
			if (key.upArrow) setChoice((c) => (c + 2) % 3);
			else if (key.downArrow) setChoice((c) => (c + 1) % 3);
			else if (key.escape) pending.resolve("no");
			else if (key.return) pending.resolve(choice === 0 ? "yes" : choice === 1 ? "always" : "no");
			return;
		}

		if (busy) return; // the model is talking; ignore keystrokes rather than queue them

		if (key.return) void submit(input);
		else if (key.backspace || key.delete) setInput((v) => v.slice(0, -1));
		else if (key.ctrl && char === "c") exit();
		else if (char && !key.ctrl && !key.meta) setInput((v) => v + char);
	});

	if (!isRawModeSupported) {
		return <Text color={theme.error}>cogent's TUI needs an interactive terminal. Use --print for piped input.</Text>;
	}

	return (
		<Box flexDirection="column">
			{/* Static prints once and scrolls away — the terminal keeps the scrollback. */}
			<Static items={items}>{(item) => <TranscriptRow key={item.id} item={item} />}</Static>

			{streaming ? (
				<Box marginTop={1} paddingLeft={2}>
					<Markdown text={streaming} />
				</Box>
			) : null}

			{activeTool ? (
				<Box marginTop={1} paddingLeft={2}>
					<Text color={theme.accent}>{SPINNER[frame]} </Text>
					<Text color={theme.tool} bold>
						{activeTool.name}
					</Text>
					<Text color={theme.muted}>{activeTool.summary ? `  ${activeTool.summary}` : ""}</Text>
				</Box>
			) : null}

			{busy && !streaming && !activeTool && !pending ? <Spinner frame={SPINNER[frame]!} label="thinking…" /> : null}

			{pending ? <PermissionDialog pending={pending} selected={choice} /> : null}

			{!pending ? (
				<Box flexDirection="column" marginTop={1}>
					<InputBox value={input} focused={!busy} />
					<StatusBar
						provider={providerName}
						model={model}
						usedTokens={tokens}
						contextLimit={props.contextLimit}
						hint={busy ? "working…" : "/help for commands"}
					/>
				</Box>
			) : null}
		</Box>
	);
}
