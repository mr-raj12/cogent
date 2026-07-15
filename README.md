# cogent

## Demo

[<img src="https://cdn.loom.com/sessions/thumbnails/366914f885fe4241a38b8a9cdad8c09b-84de9d06212644a2.gif" width="640" alt="Watch the cogent walkthrough">](https://www.loom.com/share/366914f885fe4241a38b8a9cdad8c09b)

[Watch the walkthrough](https://www.loom.com/share/366914f885fe4241a38b8a9cdad8c09b) (3:38)

<iframe width="640" height="329" src="https://www.loom.com/embed/366914f885fe4241a38b8a9cdad8c09b" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

A minimal coding agent for the terminal. It gives a language model controlled
access to your filesystem and shell through a small set of tools, then runs an
autonomous read-act loop until the task is done. Three model providers work out
of the box (Anthropic, Google Gemini, and Groq) behind a single streaming
interface.

```bash
cogent "find every TODO in src/ and tell me what's left"
echo "explain the agent loop" | cogent -p
cogent                       # interactive REPL
```

---

## Contents

- [Demo](#demo)
- [Overview](#overview)
- [Features](#features)
- [System design](#system-design)
- [Project layout](#project-layout)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tools](#tools)
- [Supported models](#supported-models)
- [Development](#development)
- [Design notes](#design-notes)

## Overview

Most "AI coding" tooling hides the agent behind a wall of SDK abstractions.
cogent is the opposite: the entire loop is a few hundred lines of readable
TypeScript, so every moving part of a tool-using agent is visible end to end —
how a tool call is parsed out of a token stream, executed, and fed back in; how
two very different provider APIs are normalized into one message format; how
streaming is threaded from the network all the way to the terminal.

It is small enough to read in a sitting and complete enough to use on real work.

## Features

- **Three providers, one interface.** Anthropic (`@anthropic-ai/sdk`), Gemini
  (`@google/genai`), and Groq (OpenAI-compatible) implement a common `Provider`
  contract. Switching is a single flag or settings key.
- **Streaming end to end.** Async generators carry tokens from the HTTP response
  through the agent loop to stdout, so output renders as it is produced.
- **Filesystem, shell, and git tools.** `Read`, `Write`, `Edit`, `Bash`, `Grep`,
  `Find`, `Ls`, and eight [git tools](docs/git-tools.md), each a self-contained
  module with a JSON-Schema signature the model sees.
- **Permission prompts before changes.** Tools that only observe run freely;
  anything that writes, runs a command, or touches git asks first, with an
  allow-for-this-session answer per tool. `--yolo` skips the prompts.
- **Provider-agnostic message format.** An internal content-block model
  (text / tool-use / tool-result) is translated per provider, including Groq's
  habit of emitting tool calls as raw text on some Llama models.
- **Layered configuration.** Global, project, and environment settings merge in
  a predictable order of precedence.
- **Three run modes.** A full-screen Ink TUI, a one-shot print mode for pipes and
  scripts, and a plain readline REPL (`--classic`, and the automatic fallback
  when stdout is not a terminal). All three render the same event stream.
- **Session persistence.** Conversations are stored as append-only JSONL, listed
  with `--list-sessions`, and resumed with `--session <id>`.
- **Context compaction.** As a conversation approaches the model's context
  window, older turns are summarized to free up room.

## System design

```
                  ┌────────────────────────────────────────────┐
   CLI args  ───▶ │                  main()                     │
   stdin     ───▶ │   parse args · load settings · build prompt │
                  └───────────────┬────────────────┬────────────┘
                                  │                │
                        print mode│      interactive REPL
                                  ▼                ▼
                  ┌──────────────────────────────────────────────┐
                  │                 runAgent()                    │
                  │   the loop: stream → collect tool calls →     │
                  │   execute tools → append results → repeat     │
                  └───────┬───────────────────────────┬──────────┘
                          │ StreamEvent                │ tool call
                          ▼                            ▼
              ┌───────────────────────┐    ┌──────────────────────┐
              │       Provider        │    │     Tool registry    │
              │   gemini  │   groq    │    │ Read Write Edit Bash │
              │  (adapters → SDKs)    │    │ Grep Find Ls         │
              └───────────────────────┘    └──────────────────────┘
                          │                            │
                          ▼                            ▼
                   Gemini / Groq API            filesystem · shell
```

Two event streams hold the system together:

- **`StreamEvent`** — what a provider yields: `text_delta`,
  `tool_use_start` / `tool_use_input_delta` / `tool_use_end`, and `message_end`.
  Each provider's only job is to turn its SDK's chunks into this vocabulary.
- **`AgentEvent`** — what the loop yields to a UI: `agent_start`, `text_delta`,
  `tool_start` / `tool_end`, `turn_end`, `agent_end`. Print mode and interactive
  mode are just two renderers of the same stream.

This separation means a new provider never touches the agent loop, and a new UI
never touches the providers.

### The agent loop

`runAgent` (`src/agent/loop.ts`) is the core:

1. Send the message history to the provider and stream the response.
2. Render text as it arrives; reassemble tool calls from their streamed
   fragments (providers deliver arguments in pieces, keyed by id).
3. If the turn produced no tool calls, stop.
4. Otherwise run each tool, append the results as a new user turn, and loop.
5. Cap at `maxTurns` (default 20) so a misbehaving model cannot run forever.

One subtlety: Gemini reports `end_turn` even when it *did* call a tool, so the
loop decides whether to continue by inspecting the content blocks it actually
received rather than trusting the stop reason.

### Provider normalization

The internal message format is a small content-block model:

```ts
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
```

Each provider translates this both ways:

- **Gemini** maps `assistant` → `model`, lifts the system prompt into
  `config.systemInstruction`, and wraps tools in `functionDeclarations`. It
  sends a tool call's arguments as one complete object and assigns no call id, so
  the adapter mints a UUID and emits the start/input/end events itself.
- **Groq** uses the OpenAI chat shape: tool calls live on the assistant message,
  results return as separate `tool` messages, and arguments stream in as string
  fragments. Some Llama models serialize tool calls as raw `<function=…>` text,
  which Groq rejects with a 400 — the adapter catches that, parses the markup out
  of `failed_generation`, and synthesizes the events.

## Project layout

```
src/
├── index.ts              # bin entry point
├── main.ts               # wiring: args → settings → prompt → mode
├── types.ts              # shared message / content-block types
├── cli/
│   └── args.ts           # argument parser, help, version
├── config/
│   ├── settings.ts       # global/project/env settings cascade
│   └── system-prompt.ts  # prompt assembly + project context files
├── providers/
│   ├── types.ts          # Provider / StreamEvent / ModelInfo contracts
│   ├── anthropic.ts      # Anthropic adapter
│   ├── gemini.ts         # Gemini adapter
│   ├── groq.ts           # Groq adapter
│   ├── errors.ts         # SDK failures to readable messages
│   └── index.ts          # provider factory + model registry
├── tools/
│   ├── types.ts          # Tool contract + result helpers
│   ├── {read,write,edit,bash,grep,find,ls}.ts
│   ├── git.ts            # eight structured git tools
│   └── index.ts          # tool registry + JSON-Schema export
├── permissions/
│   ├── types.ts          # CanUseTool contract
│   └── prompt.ts         # terminal prompt + per-session answers
├── agent/
│   ├── types.ts          # AgentEvent / AgentOptions
│   ├── loop.ts           # the agent loop
│   └── compaction.ts     # context-window summarization
├── session/
│   ├── types.ts
│   ├── store.ts          # JSONL read/append + summaries
│   └── manager.ts        # create / resume / save
├── tui/                  # Ink UI: App, components, markdown, theme
└── modes/
    ├── print.ts          # one-shot streaming to stdout
    ├── commands.ts       # slash commands
    └── interactive.ts    # readline REPL

test/                     # provider, tool, and agent-loop suites
```

## Tech stack

| Area | Choice |
|------|--------|
| Language | TypeScript (strict), ESM with `NodeNext` resolution |
| Runtime | Node 22+ |
| Model SDKs | `@anthropic-ai/sdk`, `@google/genai`, `groq-sdk` |
| Terminal UI | `ink`, `react` |
| Terminal output | `chalk`, `consola` |
| Utilities | `diff`, `glob`, `ignore` |
| Tooling | Biome (lint + format), Vitest, `tsx` |

## Getting started

Requires **Node 22+** and at least one provider key.

```bash
git clone https://github.com/mr-raj12/cogent.git
cd cogent
npm install
cp .env.example .env       # add your key(s)
```

```bash
# .env
ANTHROPIC_API_KEY=...      # https://platform.claude.com/settings/keys
GEMINI_API_KEY=...         # https://aistudio.google.com/apikey
GROQ_API_KEY=...           # https://console.groq.com/keys
```

Run it straight from source:

```bash
npm run dev -- "list the typescript files under src"
```

Or build and run the compiled binary:

```bash
npm run build
node dist/index.js "explain what this project does"
```

## Usage

```
cogent [message]            Interactive TUI (default)
cogent --print [message]    One-shot: stream the answer to stdout
echo "..." | cogent -p      Read the prompt from a pipe

Options
  --provider <name>   anthropic, gemini (default), or groq
  --model <id>        Specific model (see --list-models)
  --session <id>      Resume a saved session (see --list-sessions)
  --list-models       Print available models
  --list-sessions     Print saved sessions, newest first
  --print, -p         Non-interactive output
  --classic           Plain readline REPL instead of the TUI
  --yolo              Run tools without asking permission
  --context-limit <n> Override the model's context window
  --version, -v
  --help, -h
```

```bash
cogent --provider groq --model llama-3.3-70b-versatile "refactor src/tools/grep.ts"
cogent --list-models
```

## Configuration

Settings merge from three sources, each overriding the previous:

1. Global — `~/.cogent/settings.json`
2. Project — `.cogent/settings.json`
3. Environment — `COGENT_PROVIDER`, `COGENT_MODEL`

```jsonc
// .cogent/settings.json
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "systemPromptExtra": "Prefer functional style. Keep diffs small."
}
```

The system prompt is assembled at startup from base instructions, the live tool
list, and the first of these files found in the working directory:
`AGENTS.md`, `CLAUDE.md`, `.context`, `.cogent/context.md`.

## Tools

| Tool | What it does |
|------|--------------|
| `Read` | Read a file; returns content with line numbers, supports offset/limit |
| `Write` | Create or overwrite a file, making parent directories |
| `Edit` | Replace an exact, unique string in a file |
| `Bash` | Run a shell command (30s timeout, output capped) |
| `Grep` | Regex search across file contents |
| `Find` | Locate files by glob-style name pattern |
| `Ls` | List a directory with types and sizes |
| `Git*` | Eight structured git tools, documented in [docs/git-tools.md](docs/git-tools.md) |

A tool is an object implementing the `Tool` interface: a name, a description, a
JSON-Schema `inputSchema`, and an async `execute`. Register it in
`src/tools/index.ts` and it is immediately offered to the model. Setting
`readOnly: true` marks a tool as observe-only, which is what lets it run without
a permission prompt.

## Supported models

| Provider | Model | Context |
|----------|-------|---------|
| Anthropic | `claude-sonnet-5` | 1M |
| Anthropic | `claude-haiku-4-5` | 200K |
| Gemini | `gemini-2.5-pro` | 1M |
| Gemini | `gemini-2.5-flash` | 1M |
| Gemini | `gemini-2.0-flash` | 1M |
| Groq | `llama-3.3-70b-versatile` | 128K |
| Groq | `llama-3.1-8b-instant` | 128K |
| Groq | `deepseek-r1-distill-llama-70b` | 128K |
| Groq | `qwen-qwq-32b` | 128K |
| Groq | `moonshotai/kimi-k2-instruct` | 131K |

Adding a model is one entry in `src/providers/index.ts`.

## Development

```bash
npm run dev            # run from source (tsx)
npm run build          # tsc → dist/
npm run check          # biome lint + format check
npm run format         # biome format --write
npm run test:tools     # tool suite — no API key needed
npm run test:provider  # provider streaming (needs a key)
npm run test:agent     # full loop end to end (needs a key)
```

The tool suite runs against a temp directory and needs no network or keys; the
provider and agent suites exercise the live APIs.

## Design notes

- **Why two event vocabularies.** Keeping `StreamEvent` (provider-facing) and
  `AgentEvent` (UI-facing) separate stops provider quirks from leaking into the
  loop and keeps the UI agnostic to which model is running.
- **Why content blocks instead of plain strings.** Tool use and tool results
  need structure the model can round-trip. A single internal shape lets each
  provider own its translation and keeps the loop provider-neutral.
- **Why a turn cap.** Tool-using models can loop. A hard `maxTurns` bound makes
  runs predictable and bounds cost.
- **Adding a provider** means implementing one `complete()` generator that emits
  `StreamEvent`s; nothing else in the system changes.
