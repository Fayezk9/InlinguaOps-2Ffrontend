import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getDebugEntries, onDebugChange, clearDebug } from "@/lib/debug";
import { Button } from "@/components/ui/button";

export default function DebugPanel() {
  const [open, setOpen] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return onDebugChange(() => setVersion((v) => v + 1));
  }, []);

  const entries = useMemo(() => getDebugEntries(), [version]);
  const latest = entries[0];

  return (
    <div
      className={cn(
        "fixed left-2 top-16 z-[60]",
        "border rounded-md shadow-lg",
        "bg-white/95 text-black dark:bg-neutral-900/95 dark:text-white",
        open ? "w-[360px]" : "w-[42px]",
      )}
      style={{ maxHeight: "calc(100vh - 80px)" }}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b dark:border-white/10">
        <button
          className="text-xs font-bold px-1 py-0.5 rounded border dark:border-white/20"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle debug panel"
        >
          {open ? "⟨" : "⟩"}
        </button>
        {open && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Debug</span>
            <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => clearDebug()}>
              Clear
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="p-2 text-xs overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
          <div className="mb-2">
            <div className="font-semibold mb-1">Recent Requests</div>
            <ul className="space-y-1">
              {entries.slice(0, 12).map((e) => (
                <li key={e.id} className="truncate">
                  <span className={cn("font-mono", e.ok ? "text-emerald-600" : "text-red-600")}>{e.status ?? "?"}</span>
                  <span className="mx-1">{e.method}</span>
                  <span className="font-mono">{e.url}</span>
                </li>
              ))}
            </ul>
          </div>
          {latest && (
            <div className="space-y-1">
              <div className="font-semibold">Latest Detail</div>
              <div><span className="font-mono">{latest.method}</span> <span className="font-mono">{latest.url}</span></div>
              <div>Status: <span className={cn(latest.ok ? "text-emerald-600" : "text-red-600")}>{String(latest.status)}</span></div>
              {latest.error && <div className="text-red-600">Error: {latest.error}</div>}
              {latest.req && (
                <div>
                  <div className="font-medium mt-1">Request Body</div>
                  <pre className="whitespace-pre-wrap break-words bg-black/5 dark:bg-white/10 rounded p-1 max-h-28 overflow-auto">{latest.req}</pre>
                </div>
              )}
              {latest.resp && (
                <div>
                  <div className="font-medium mt-1">Response</div>
                  <pre className="whitespace-pre-wrap break-words bg-black/5 dark:bg-white/10 rounded p-1 max-h-40 overflow-auto">{latest.resp}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
