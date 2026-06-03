// PHASE 10 — Full CLI argument parsing
// For now: a minimal version that gets us through Phases 1-9

export interface CliArgs {
	// Mode
	print: boolean; // --print or -p: non-interactive, stream to stdout
	// Provider/model
	provider?: string; // --provider gemini|groq
	model?: string; // --model <id>
	// Session
	session?: string; // --session <id>: resume an existing session
	// Debug/info
	listModels: boolean; // --list-models
	version: boolean; // --version
	help: boolean; // --help
	// Initial message (remaining args or stdin)
	message?: string; // first positional argument
}

export function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {
		print: false,
		listModels: false,
		version: false,
		help: false,
	};

	const positional: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		switch (arg) {
			case "--print":
			case "-p":
				args.print = true;
				break;
			case "--list-models":
				args.listModels = true;
				break;
			case "--version":
			case "-v":
				args.version = true;
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
			case "--provider":
				args.provider = argv[++i];
				break;
			case "--model":
				args.model = argv[++i];
				break;
			case "--session":
				args.session = argv[++i];
				break;
			default:
				if (!arg.startsWith("-")) positional.push(arg);
		}
	}

	if (positional.length > 0) {
		args.message = positional.join(" ");
	}

	return args;
}

export function printHelp(): void {
	console.log(`
pi-clone — minimal coding agent

USAGE
  pi-clone [message]          Interactive mode (default)
  pi-clone --print [message]  Print mode: stream output to stdout

OPTIONS
  --provider <name>   Provider to use: gemini (default) or groq
  --model <id>        Model ID to use (see --list-models)
  --session <id>      Resume a previous session
  --list-models       List all available models
  --print, -p         Non-interactive: output to stdout
  --version, -v       Show version
  --help, -h          Show this help

ENVIRONMENT
  GEMINI_API_KEY      Google Gemini API key
  GROQ_API_KEY        Groq API key
  PI_CLONE_PROVIDER   Default provider
  PI_CLONE_MODEL      Default model

EXAMPLES
  pi-clone                                  # Start interactive chat
  pi-clone "explain this codebase"          # One-shot interactive
  echo "list all ts files" | pi-clone -p    # Pipe input, stream output
`);
}

export function printVersion(): void {
	console.log("pi-clone 0.1.0");
}
