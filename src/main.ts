// Main entry point — wires together CLI args, settings, and modes

import { parseArgs, printHelp, printVersion } from "./cli/args.js";
import { loadSettings } from "./config/settings.js";
import { MODELS, getDefaultModel } from "./providers/index.js";
import { buildSystemPrompt } from "./config/system-prompt.js";
import { runPrintMode } from "./modes/print.js";
import { runInteractiveMode } from "./modes/interactive.js";
import type { Message } from "./types.js";

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  // Info commands — exit immediately
  if (args.help) {
    printHelp();
    return;
  }
  if (args.version) {
    printVersion();
    return;
  }
  if (args.listModels) {
    console.log("\nAvailable models:\n");
    for (const m of MODELS) {
      console.log(`  ${m.provider.padEnd(8)} ${m.id.padEnd(42)} ${m.name}`);
    }
    console.log();
    return;
  }

  // Load settings (global + project + env vars)
  const settings = await loadSettings();

  // Determine provider and model
  const providerName =
    args.provider ??
    settings.provider ??
    process.env.PI_CLONE_PROVIDER ??
    "gemini";
  const model =
    args.model ??
    settings.model ??
    process.env.PI_CLONE_MODEL ??
    getDefaultModel(providerName);

  // Build starting messages
  const messages: Message[] = [];

  // If a message was passed as argument, add it
  if (args.message) {
    messages.push({ role: "user", content: args.message });
  }

  // If stdin is piped (not a TTY), read it as the first message
  if (!process.stdin.isTTY && !args.message) {
    const stdinData = await readStdin();
    if (stdinData.trim()) {
      messages.push({ role: "user", content: stdinData.trim() });
    }
  }

  // Build system prompt
  // NOTE: This will throw until Phase 6 is done — that's expected
  let system = "You are pi-clone, a helpful coding assistant.";
  try {
    system = await buildSystemPrompt(settings.systemPromptExtra);
  } catch {
    // buildSystemPrompt not implemented yet — use fallback
  }

  const agentOptions = { providerName, model, system, messages, maxTurns: 20 };

  // Route to the right mode
  //[FFINALL_IFFF] if (args.print || messages.length > 0 && !process.stdin.isTTY) {
  if (args.print || messages.length > 0) {
    // Print mode: we have a message to process, stream output
    await runPrintMode(agentOptions);
  } else {
    // Interactive mode: full chat UI
    await runInteractiveMode({ providerName, model });
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

main(process.argv.slice(2)).catch(console.error);
