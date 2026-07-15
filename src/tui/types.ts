// What the transcript is made of. The agent loop's events are folded into these
// so the view never has to know about providers or content blocks.

export type Tone = "info" | "warn" | "error" | "success";

export type Item =
	| { id: number; kind: "user"; text: string }
	| { id: number; kind: "assistant"; text: string }
	| { id: number; kind: "notice"; tone: Tone; text: string }
	| {
			id: number;
			kind: "tool";
			name: string;
			summary: string;
			result: string;
			isError: boolean;
			denied: boolean;
	  };

// A transcript item before it gets its id. Omit<> alone would collapse the union
// down to its shared keys, so distribute it across each member.
export type DraftItem = Item extends infer T ? (T extends Item ? Omit<T, "id"> : never) : never;

export interface PendingPermission {
	name: string;
	summary: string;
	resolve: (choice: "yes" | "always" | "no") => void;
}
