export type HistoryEvent = {
  id: string;
  type: string;
  message: string;
  at: number; // epoch ms
  user?: string;
  meta?: any;
};

const KEY = "appHistory";
const MAX_EVENTS = 500;
const CHANGE_EVENT = "history:changed";

function read(): HistoryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(events: HistoryEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  // Notify listeners
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getHistory(): HistoryEvent[] {
  return read().sort((a, b) => b.at - a.at);
}

export function clearHistory() {
  write([]);
}

export function getCurrentUserName(): string {
  if (typeof window === "undefined") return "User";
  return localStorage.getItem("currentUserName") || "User";
}

export function logHistory(input: { message: string; type?: string; meta?: any; user?: string; at?: number }) {
  const events = read();
  const e: HistoryEvent = {
    id: crypto.randomUUID(),
    type: input.type || "info",
    message: input.message,
    at: input.at ?? Date.now(),
    user: input.user || getCurrentUserName(),
    meta: input.meta,
  };
  events.push(e);
  write(events);
}

export function onHistoryChanged(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", (ev) => {
    if (ev.key === KEY) handler();
  });
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
