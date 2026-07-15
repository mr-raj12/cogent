// One place for every colour the TUI uses, so the palette stays coherent.

export const theme = {
	accent: "#c96442", // cogent's terracotta — prompt marker, focus, brand
	user: "#7aa2f7",
	assistant: "#e6e6e6",
	tool: "#7dcfff",
	success: "#9ece6a",
	warn: "#e0af68",
	error: "#f7768e",
	muted: "#6c7086",
} as const;

export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
