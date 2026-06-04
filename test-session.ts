import { createSession, saveMessage } from "./src/session/manager.js";
import { loadSession } from "./src/session/store.js";

const s = await createSession("llama3-70b-8192", "groq");
console.log("created:", s.id);

await saveMessage(s.id, { role: "user", content: "hello" });

const loaded = await loadSession(s.id);
console.log("loaded messages:", loaded?.messages);
