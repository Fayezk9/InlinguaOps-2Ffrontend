import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function parseSheetId(input: string): string | null {
  try {
    const u = new URL(input);
    const p = u.pathname.split("/");
    const idx = p.indexOf("d");
    return idx >= 0 ? p[idx + 1] : null;
  } catch {
    return null;
  }
}

function toEmbedBaseById(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/pubhtml?widget=true&headers=false`;
}

function toEmbedUrl(url: string, overrideGid?: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/d/")) {
      const parts = u.pathname.split("/"), idIdx = parts.indexOf("d");
      const id = idIdx >= 0 ? parts[idIdx + 1] : parts[parts.indexOf("spreadsheets") + 2];
      const base = toEmbedBaseById(id);
      const gid = overrideGid || u.searchParams.get("gid") || (u.hash.includes("gid=") ? u.hash.split("gid=")[1].split(/[&#]/)[0] : "");
      return gid ? `${base}&gid=${gid}` : base;
    }
    return url;
  } catch {
    return url;
  }
}

function normalize(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MONTHS: { key: string; label: string; tokens: string[] }[] = [
  { key: "jan", label: "Jan", tokens: ["jan", "january", "januar"] },
  { key: "feb", label: "Feb", tokens: ["feb", "february", "februar"] },
  { key: "mar", label: "Mar", tokens: ["mar", "march", "marz", "maerz", "märz", "mär"] },
  { key: "apr", label: "Apr", tokens: ["apr", "april"] },
  { key: "mai", label: "Mai", tokens: ["mai", "may"] },
  { key: "jun", label: "Juni", tokens: ["jun", "juni", "june"] },
  { key: "jul", label: "Juli", tokens: ["jul", "juli", "july"] },
  { key: "aug", label: "Aug", tokens: ["aug", "august"] },
  { key: "sep", label: "Seb", tokens: ["sep", "sept", "september", "seb"] },
  { key: "okt", label: "Okt", tokens: ["okt", "oct", "oktober", "october"] },
  { key: "nov", label: "Nov", tokens: ["nov", "november"] },
  { key: "dec", label: "Dec", tokens: ["dec", "dez", "dezember", "december"] },
];

export default function Telc() {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [tabs, setTabs] = useState<{ title: string; gid: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const m = typeof window !== "undefined" ? localStorage.getItem("telcMonth") : null;
    if (m) return m;
    const now = new Date().getMonth();
    return MONTHS[Math.min(Math.max(now, 0), 11)].key;
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const y = typeof window !== "undefined" ? Number(localStorage.getItem("telcYear") || 0) : 0;
    const now = new Date().getFullYear();
    if (y >= 2025 && y <= 2030) return y;
    return now >= 2025 && now <= 2030 ? now : 2025;
  });

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

  const [tabsLoaded, setTabsLoaded] = useState(false);
  useEffect(() => {
    setTabsLoaded(false);
    if (!savedUrl || !configured) return;
    const id = parseSheetId(savedUrl);
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/sheets/tabs?id=${encodeURIComponent(id)}`);
        if (r.ok) {
          const j = (await r.json()) as { sheets: { title: string; gid: string }[] };
          const filtered = (j.sheets || []).filter((s) => !normalize(s.title).includes("vorlage"));
          setTabs(filtered);
        }
      } catch {}
      setTabsLoaded(true);
    })();
  }, [savedUrl, configured]);

  const { gid: chosenGid, found: hasMatch } = useMemo(() => {
    if (!tabs.length) return { gid: "", found: false };
    const mIdx = Math.max(0, MONTHS.findIndex((m) => m.key === selectedMonth));
    const nameTokens = MONTHS.find((m) => m.key === selectedMonth)?.tokens || [];
    const numTokens = [String(mIdx + 1), String(mIdx + 1).padStart(2, "0")];
    const yStr = String(selectedYear);

    const scored = tabs
      .map((s) => {
        const t = normalize(s.title);
        const parts = t.split(/\s+/);
        const textHit = nameTokens.some((tok) => t.includes(normalize(tok)));
        const numHit = parts.includes(numTokens[0]) || parts.includes(numTokens[1]);
        const monthHit = textHit || numHit;
        const yearHit = parts.includes(yStr);
        const score = monthHit ? (yearHit ? 3 : 2) : 0;
        return { gid: s.gid, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored.find((x) => x.score > 0);
    return { gid: best ? best.gid : "", found: Boolean(best) };
  }, [tabs, selectedMonth, selectedYear]);

  const embedUrl = useMemo(() => (savedUrl && chosenGid ? toEmbedUrl(savedUrl, chosenGid) : null), [savedUrl, chosenGid]);

  const onSelectYear = (y: number) => {
    setSelectedYear(y);
    if (typeof window !== "undefined") localStorage.setItem("telcYear", String(y));
  };
  const onSelectMonth = (key: string) => {
    setSelectedMonth(key);
    if (typeof window !== "undefined") localStorage.setItem("telcMonth", key);
  };

  return (
    <div className="w-full px-2 md:px-4 py-6 md:py-8">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>telc Bereich</CardTitle>
          {savedUrl && (
            <div className="mt-3 flex items-center gap-3 overflow-x-auto">
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={selectedYear}
                onChange={(e) => onSelectYear(Number(e.target.value))}
              >
                {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                {MONTHS.map((m) => (
                  <Button
                    key={m.key}
                    variant={m.key === selectedMonth ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSelectMonth(m.key)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!savedUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No sheet configured. Go to Settings → Google Sheets and paste your link.</p>
              <Link to="/settings" className="inline-flex items-center gap-2 rounded-md border border-border bg-neutral-100 px-3 py-2 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">Open Settings</Link>
            </div>
          ) : tabsLoaded && !embedUrl ? (
            <div className="h-[85vh] flex items-center justify-center text-xl text-muted-foreground select-none">keine Daten</div>
          ) : embedUrl ? (
            <div className="relative rounded-lg border border-border overflow-hidden shadow-sm">
              <iframe
                title="Google Sheet"
                src={embedUrl}
                className="w-full bg-white dark:bg-neutral-900"
                style={{ height: "85vh" }}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-[85vh] flex items-center justify-center text-sm text-muted-foreground">Lädt…</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
