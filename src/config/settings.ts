// PHASE 7 — Load and merge settings
// Global: ~/.pi-clone/settings.json
// Project: .pi-clone/settings.json (overrides global)
// Env vars: override everything

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Settings } from "./types.js";

export function getGlobalSettingsPath(): string {
	return join(homedir(), ".pi-clone", "settings.json");
}

export function getProjectSettingsPath(): string {
	return join(process.cwd(), ".pi-clone", "settings.json");
}

export async function loadSettings(): Promise<Settings> {
	// TODO PHASE 7 — Load and merge settings from 3 sources
	//
	// Priority (highest wins): env vars > project settings > global settings
	//
	// 1. Load global settings:
	//    const global = await readJsonSafe(getGlobalSettingsPath());
	//
	// 2. Load project settings:
	//    const project = await readJsonSafe(getProjectSettingsPath());
	//
	// 3. Merge (project overrides global):
	//    const merged: Settings = { ...global, ...project };
	//
	// 4. Override with env vars if set:
	//    if (process.env.PI_CLONE_PROVIDER) merged.provider = process.env.PI_CLONE_PROVIDER;
	//    if (process.env.PI_CLONE_MODEL) merged.model = process.env.PI_CLONE_MODEL;
	//
	// 5. Return merged settings:
	//    return merged;

	void readFile;
	void existsSync;
	void join;
	void homedir;
	return {};
}

export async function saveGlobalSettings(settings: Settings): Promise<void> {
	// TODO PHASE 7 — Save settings to the global settings file
	//
	// await mkdir(join(homedir(), ".pi-clone"), { recursive: true });
	// await writeFile(getGlobalSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");

	void settings;
	void writeFile;
	void mkdir;
	void homedir;
}

// Helper: read a JSON file, return {} if missing or invalid
async function readJsonSafe(path: string): Promise<Partial<Settings>> {
	if (!existsSync(path)) return {};
	try {
		const raw = await readFile(path, "utf-8");
		return JSON.parse(raw) as Partial<Settings>;
	} catch {
		return {};
	}
}

export { readJsonSafe };
