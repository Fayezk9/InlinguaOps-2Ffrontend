import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [input, setInput] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = localStorage.getItem("telcSheetUrl");
    if (s) setSavedUrl(s);
  }, []);

  const embedUrl = useMemo(() => (savedUrl ? toEmbedUrl(savedUrl) : null), [savedUrl]);

  const save = () => {
    const v = input.trim();
    if (!v) return;
    localStorage.setItem("telcSheetUrl", v);
    setSavedUrl(v);
    setInput("");
  };

  const change = () => {
    setInput(savedUrl ?? "");
    setSavedUrl(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>telc Bereich</CardTitle>
        </CardHeader>
        <CardContent>
          {embedUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={change}>Change sheet</Button>
                <a href={embedUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary">Open in new tab</Button>
                </a>
              </div>
              <div className="relative rounded-lg border border-border overflow-hidden shadow-sm">
                <iframe
                  title="Google Sheet"
                  src={embedUrl}
                  className="w-full h-[78vh] bg-white dark:bg-neutral-900"
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Paste your Google Sheet link. For best results, publish the sheet to the web.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button onClick={save} disabled={!input.trim()}>Save</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
