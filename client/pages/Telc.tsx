import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/d/")) {
      const parts = u.pathname.split("/"), idIdx = parts.indexOf("d");
      const id = idIdx >= 0 ? parts[idIdx + 1] : parts[parts.indexOf("spreadsheets") + 2];
      const gid = u.searchParams.get("gid") || (u.hash.includes("gid=") ? u.hash.split("gid=")[1].split(/[&#]/)[0] : "");
      const base = `https://docs.google.com/spreadsheets/d/${id}/pubhtml?widget=true&headers=false`;
      return gid ? `${base}&gid=${gid}` : base;
    }
    return url;
  } catch {
    return url;
  }
}

export default function Telc() {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [preview, setPreview] = useState<{ title: string; values: string[][] } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSavedUrl(localStorage.getItem("telcSheetUrl"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/sheets/status");
        const j = await r.json();
        setConfigured(Boolean(j?.configured));
      } catch {}
    })();
  }, []);

  const embedUrl = useMemo(() => (savedUrl ? toEmbedUrl(savedUrl) : null), [savedUrl]);

  useEffect(() => {
    const id = (() => {
      if (!savedUrl) return null;
      try {
        const u = new URL(savedUrl);
        const parts = u.pathname.split("/");
        const i = parts.indexOf("d");
        return i >= 0 ? parts[i + 1] : savedUrl;
      } catch {
        return savedUrl;
      }
    })();
    if (!configured || !id) return setPreview(null);
    (async () => {
      try {
        const r = await fetch(`/api/sheets/preview?id=${encodeURIComponent(id)}`);
        if (r.ok) setPreview(await r.json());
        else setPreview(null);
      } catch {
        setPreview(null);
      }
    })();
  }, [configured, savedUrl]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>telc Bereich</CardTitle>
        </CardHeader>
        <CardContent>
          {preview ? (
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800">
                    {(preview.values[0] || []).map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left border-b border-border">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.values.slice(1).map((row, r) => (
                    <tr key={r} className={cn("border-b border-border", r % 2 ? "bg-neutral-50/50 dark:bg-neutral-900/20" : "") }>
                      {row.map((c, i) => (
                        <td key={i} className="px-3 py-2 align-top">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : embedUrl ? (
            <div className="relative rounded-lg border border-border overflow-hidden shadow-sm">
              <iframe
                title="Google Sheet"
                src={embedUrl}
                className="w-full h-[78vh] bg-white dark:bg-neutral-900"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No sheet configured. Go to Settings → Google Sheets and paste your link.</p>
              <Link to="/settings" className="inline-flex items-center gap-2 rounded-md border border-border bg-neutral-100 px-3 py-2 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">Open Settings</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
