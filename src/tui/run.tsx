// Entry point for the TUI: render the app and resolve when the user exits.

import { render } from "ink";
import { createSession } from "../session/manager.js";
import type { Session } from "../session/types.js";
import { App } from "./App.js";
import { Banner } from "./components.js";

export interface TuiOptions {
	providerName: string;
	model: string;
	system: string;
	contextLimit?: number;
	yolo: boolean;
	session?: Session;
}

export async function runTui(options: TuiOptions): Promise<void> {
	const session = options.session ?? (await createSession(options.model, options.providerName));

	// The banner is printed once, outside the React tree, so it stays at the top
	// of the scrollback instead of being re-rendered on every keystroke.
	const banner = render(<Banner provider={options.providerName} model={options.model} session={session.id} />);
	banner.unmount();

	const app = render(
		<App
			providerName={options.providerName}
			model={options.model}
			system={options.system}
			sessionId={session.id}
			initialMessages={options.session?.messages ?? []}
			contextLimit={options.contextLimit}
			yolo={options.yolo}
		/>,
	);

	await app.waitUntilExit();
	console.log(`\nSession saved: ${session.id}`);
	console.log(`Resume it with: cogent --session ${session.id}\n`);
}
