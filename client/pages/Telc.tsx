import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSavedUrl(localStorage.getItem("telcSheetUrl"));
  }, []);

  const embedUrl = useMemo(() => (savedUrl ? toEmbedUrl(savedUrl) : null), [savedUrl]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>telc Bereich</CardTitle>
        </CardHeader>
        <CardContent>
          {embedUrl ? (
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
              <p className="text-sm text-muted-foreground">No sheet configured. Go to Settings → Google Sheet and paste your link.</p>
              <Link to="/settings" className="inline-flex items-center gap-2 rounded-md border border-border bg-neutral-100 px-3 py-2 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">Open Settings</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
