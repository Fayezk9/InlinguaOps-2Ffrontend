export type DebugEntry = {
  id: string;
  time: number;
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  req?: string;
  resp?: string;
  error?: string;
};

const store: DebugEntry[] = [];
let installed = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function onDebugChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getDebugEntries() {
  return store.slice().sort((a, b) => b.time - a.time);
}

export function clearDebug() {
  store.length = 0;
  emit();
}

function preview(value: any, max = 1600): string | undefined {
  if (value == null) return undefined;
  try {
    if (typeof value === "string") return value.slice(0, max);
    return JSON.stringify(value).slice(0, max);
  } catch {
    try { return String(value).slice(0, max); } catch { return undefined; }
  }
}

export function installFetchInterceptor() {
  if (installed) return;
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as any).url ?? String(input);
    const method = (init?.method || (input as any)?.method || "GET").toUpperCase();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: DebugEntry = {
      id,
      time: Date.now(),
      method,
      url,
      req: preview((init as any)?.body),
    };
    store.unshift(entry);
    if (store.length > 50) store.pop();
    emit();
    try {
      const res = await orig(input as any, init);
      entry.status = (res as any)?.status;
      entry.ok = (res as any)?.ok;
      try {
        const clone = res.clone();
        const text = await clone.text();
        entry.resp = preview(text);
      } catch {}
      emit();
      return res;
    } catch (e: any) {
      entry.error = e?.message || String(e);
      emit();
      throw e;
    }
  } as any;
}