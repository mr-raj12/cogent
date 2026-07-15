// A small markdown renderer for assistant prose. Models answer in markdown, and
// printing the raw source ("**bold**", "## Heading") is the loudest thing wrong
// with an otherwise clean transcript. This covers the subset models actually
// emit — headings, lists, fences, and inline emphasis — and deliberately stops
// there rather than growing into a full CommonMark parser.

import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { theme } from "./theme.js";

// Inline spans: **bold**, `code`, *italic*/_italic_. Ordered so ** wins over *.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let last = 0;
	let match: RegExpExecArray | null;

	INLINE.lastIndex = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard exec-loop idiom
	while ((match = INLINE.exec(text)) !== null) {
		if (match.index > last) nodes.push(text.slice(last, match.index));

		const token = match[0];
		const key = `${keyPrefix}-${match.index}`;
		if (token.startsWith("**")) {
			nodes.push(
				<Text key={key} bold>
					{token.slice(2, -2)}
				</Text>,
			);
		} else if (token.startsWith("`")) {
			nodes.push(
				<Text key={key} color={theme.tool}>
					{token.slice(1, -1)}
				</Text>,
			);
		} else {
			nodes.push(
				<Text key={key} italic>
					{token.slice(1, -1)}
				</Text>,
			);
		}
		last = match.index + token.length;
	}

	if (last < text.length) nodes.push(text.slice(last));
	return nodes;
}

interface Block {
	key: string;
	node: ReactNode;
}

export function Markdown({ text }: { text: string }) {
	const blocks: Block[] = [];
	const lines = text.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const key = `l${i}`;

		// Fenced code: consume through the closing fence and print it verbatim.
		const fence = line.match(/^\s*```(\w*)/);
		if (fence) {
			const body: string[] = [];
			i++;
			while (i < lines.length && !/^\s*```/.test(lines[i]!)) {
				body.push(lines[i]!);
				i++;
			}
			blocks.push({
				key,
				node: (
					<Box flexDirection="column" marginY={1} paddingLeft={1} borderStyle="round" borderColor={theme.muted}>
						{fence[1] ? <Text color={theme.muted}>{fence[1]}</Text> : null}
						<Text color={theme.tool}>{body.join("\n")}</Text>
					</Box>
				),
			});
			continue;
		}

		// Blank lines become vertical space rather than an empty Text row. Headings
		// and fences carry their own top margin, so a blank before one would stack
		// into a double gap — let their margin do the work instead.
		if (!line.trim()) {
			const next = lines[i + 1] ?? "";
			if (/^\s*(#{1,6}\s|```)/.test(next) || !next.trim()) continue;
			blocks.push({ key, node: <Box height={1} /> });
			continue;
		}

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			blocks.push({
				key,
				node: (
					<Box marginTop={1}>
						<Text color={theme.accent} bold>
							{renderInline(heading[2]!, key)}
						</Text>
					</Box>
				),
			});
			continue;
		}

		// Horizontal rules read as a divider, not three literal dashes.
		if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
			blocks.push({ key, node: <Text color={theme.muted}>{"─".repeat(40)}</Text> });
			continue;
		}

		// Bullets: keep the author's indent, swap the marker for a real bullet.
		const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
		if (bullet) {
			const indent = Math.floor(bullet[1]!.length / 2);
			blocks.push({
				key,
				node: (
					<Box paddingLeft={indent * 2}>
						<Text color={theme.accent}>{"• "}</Text>
						<Text color={theme.assistant}>{renderInline(bullet[2]!, key)}</Text>
					</Box>
				),
			});
			continue;
		}

		const numbered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
		if (numbered) {
			const indent = Math.floor(numbered[1]!.length / 2);
			blocks.push({
				key,
				node: (
					<Box paddingLeft={indent * 2}>
						<Text color={theme.accent}>{numbered[2]}. </Text>
						<Text color={theme.assistant}>{renderInline(numbered[3]!, key)}</Text>
					</Box>
				),
			});
			continue;
		}

		blocks.push({
			key,
			node: <Text color={theme.assistant}>{renderInline(line, key)}</Text>,
		});
	}

	return (
		<Box flexDirection="column">
			{blocks.map((b) => (
				<Box key={b.key}>{b.node}</Box>
			))}
		</Box>
	);
}
