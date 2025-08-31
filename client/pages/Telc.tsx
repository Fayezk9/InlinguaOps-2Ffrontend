import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AddPersonDialog from "@/components/AddPersonDialog";

function parseSheetId(input: string): string | null {
  try {
    const u = new URL(input);
    const p = u.pathname.split("/");
    const idx = p.indexOf("d");
    return idx >= 0 ? p[idx + 1] : null;
  } catch {
    // If it's a bare ID (common Sheets ID pattern), accept it directly
    if (/^[A-Za-z0-9-_]{20,}$/.test(input)) return input;
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
  { key: "sep", label: "Sep", tokens: ["sep", "sept", "september", "seb"] },
  { key: "okt", label: "Okt", tokens: ["okt", "oct", "oktober", "october"] },
  { key: "nov", label: "Nov", tokens: ["nov", "november"] },
  { key: "dec", label: "Dec", tokens: ["dec", "dez", "dezember", "december"] },
];

export default function Telc() {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [apiOk, setApiOk] = useState<boolean>(false);
  const [apiBase, setApiBase] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [tabs, setTabs] = useState<{ title: string; gid: string; index: number }[]>([]);
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
    let timeout: number | null = null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    (async () => {
      async function ping(base: string) {
        try {
          if (controller) timeout = window.setTimeout(() => controller.abort(), 2500);
          const r = await fetch(`${base}/ping`, { signal: controller?.signal });
          return r.ok;
        } catch { return false; } finally { if (timeout) clearTimeout(timeout); }
      }
      if (await ping("/api")) { setApiBase("/api"); setApiOk(true); return; }
      if (await ping("/.netlify/functions/api")) { setApiBase("/.netlify/functions/api"); setApiOk(true); return; }
      setApiBase(""); setApiOk(false);
    })();
    return () => { if (timeout) clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    (async () => {
      if (!apiOk || !apiBase) { setConfigured(false); return; }
      try {
        const r = await fetch(`${apiBase}/sheets/status`);
        const j = await r.json();
        setConfigured(Boolean(j?.configured));
      } catch {
        setConfigured(false);
      }
    })();
  }, [apiOk, apiBase]);

  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [tabsError, setTabsError] = useState(false);
  useEffect(() => {
    setTabsLoaded(false);
    setTabsError(false);
    setTabs([]);
    if (!apiOk || !apiBase || !savedUrl || !configured) return;
    const id = parseSheetId(savedUrl);
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/sheets/tabs?id=${encodeURIComponent(id)}`);
        if (r.ok) {
          const j = (await r.json()) as { sheets: { title: string; gid: string; index: number }[] };
          const filtered = (j.sheets || []).filter((s) => !normalize(s.title).includes("vorlage"));
          setTabs(filtered);
        } else {
          setTabsError(true);
        }
      } catch {
        setTabsError(true);
      }
      setTabsLoaded(true);
    })();
  }, [savedUrl, configured, apiOk, apiBase]);

  const { gid: chosenGid, found: hasMatch } = useMemo(() => {
    if (!tabs.length) return { gid: "", found: false };
    const mIdx = Math.max(0, MONTHS.findIndex((m) => m.key === selectedMonth));
    const nameTokens = MONTHS.find((m) => m.key === selectedMonth)?.tokens || [];
    const monthNum1 = String(mIdx + 1);
    const monthNum2 = monthNum1.padStart(2, "0");
    const yStr = String(selectedYear);

    const byIndex = (arr: typeof tabs) => [...arr].sort((a, b) => a.index - b.index);

    const normalizeDigits = (s: string) => {
      const only = s.replace(/[^0-9]+/g, ".");
      return only.replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
    };
    const patterns = new Set([
      `${monthNum2}.${yStr}`,
      `${monthNum1}.${yStr}`,
      `${yStr}.${monthNum2}`,
      `${yStr}.${monthNum1}`,
    ]);

    // 1) Exact numeric pattern match
    for (const s of tabs) {
      const n = normalizeDigits(s.title);
      if (patterns.has(n)) return { gid: s.gid, found: true };
    }

    // 2) Order mapping within selected year
    const inYear = byIndex(tabs.filter((t) => normalize(t.title).includes(yStr)));
    if (inYear[mIdx]) return { gid: inYear[mIdx].gid, found: true };

    // 3) Order mapping across all (first=Jan, second=Feb,...)
    const all = byIndex(tabs);
    if (all[mIdx]) return { gid: all[mIdx].gid, found: true };

    // 4) Fallback: textual month/year scoring
    const scored = tabs
      .map((s) => {
        const t = normalize(s.title);
        const parts = t.split(/\s+/);
        const textHit = nameTokens.some((tok) => t.includes(normalize(tok)));
        const numHit = parts.includes(monthNum1) || parts.includes(monthNum2);
        const yearHit = parts.includes(yStr);
        const score = (textHit || numHit) ? (yearHit ? 3 : 2) : 0;
        return { gid: s.gid, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored.find((x) => x.score > 0);
    return { gid: best ? best.gid : "", found: Boolean(best) };
  }, [tabs, selectedMonth, selectedYear]);

  const embedBase = useMemo(() => {
    if (!savedUrl) return null;
    const id = parseSheetId(savedUrl);
    return id ? toEmbedBaseById(id) : toEmbedUrl(savedUrl);
  }, [savedUrl]);
  const embedUrl = useMemo(() => {
    if (!savedUrl) return null;
    const id = parseSheetId(savedUrl);
    const base = id ? toEmbedBaseById(id) : toEmbedUrl(savedUrl);
    if (chosenGid && id) return `${base}&gid=${chosenGid}`;
    if (chosenGid && !id) return toEmbedUrl(savedUrl, chosenGid);
    return base;
  }, [savedUrl, chosenGid]);

  const selectedTab = useMemo(() => tabs.find((t) => t.gid === chosenGid) || null, [tabs, chosenGid]);
  const [values, setValues] = useState<string[][] | null>(null);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesError, setValuesError] = useState(false);
  const widthsStorageKey = useMemo(() => {
    const id = savedUrl ? parseSheetId(savedUrl) : null;
    return `telcColWidths:${id || "default"}`;
  }, [savedUrl]);
  const [colWidthMap, setColWidthMap] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(widthsStorageKey);
      setColWidthMap(raw ? JSON.parse(raw) : {});
    } catch {
      setColWidthMap({});
    }
  }, [widthsStorageKey, selectedTab?.title]);
  const headerRefs = useRef<Record<number, HTMLTableCellElement | null>>({});
  const startResize = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = headerRefs.current[i];
    if (!el || !values) return;
    const headers = values[0] || [];
    const label = String(headers[i] ?? "");
    const k = normalize(label).replace(/\s+/g, "");
    const startX = e.clientX;
    const startW = el.getBoundingClientRect().width;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(40, Math.round(startW + dx));
      setColWidthMap((prev) => {
        const updated = { ...prev, [k]: next };
        try { localStorage.setItem(widthsStorageKey, JSON.stringify(updated)); } catch {}
        return updated;
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    setValues(null);
    setValuesError(false);
    if (!apiOk || !apiBase) return;
    if (!configured) return;
    if (!savedUrl) return;
    const id = parseSheetId(savedUrl);
    if (!id) return;
    if (!selectedTab) return;
    setValuesLoading(true);
    (async () => {
      try {
        const r = await fetch(`${apiBase}/sheets/values?id=${encodeURIComponent(id)}&title=${encodeURIComponent(selectedTab.title)}&range=A1:ZZ1000`);
        if (r.ok) {
          const j = (await r.json()) as { title: string; values: string[][] };
          setValues(j.values || []);
        } else {
          setValuesError(true);
        }
      } catch {
        setValuesError(true);
      }
      setValuesLoading(false);
    })();
  }, [apiOk, apiBase, configured, savedUrl, selectedTab, refreshTick]);

  const onSelectYear = (y: number) => {
    setSelectedYear(y);
    if (typeof window !== "undefined") localStorage.setItem("telcYear", String(y));
  };
  const onSelectMonth = (key: string) => {
    setSelectedMonth(key);
    if (typeof window !== "undefined") localStorage.setItem("telcMonth", key);
  };

  const [scale, setScale] = useState<number>(() => {
    if (typeof window === "undefined") return 0.85;
    const v = Number(localStorage.getItem("sheetScale") || 0.85);
    return isNaN(v) ? 0.85 : Math.min(1.5, Math.max(0.6, v));
  });
  const changeScale = (delta: number) => {
    const next = Math.min(1.5, Math.max(0.6, Math.round((scale + delta) * 100) / 100));
    setScale(next);
    if (typeof window !== "undefined") localStorage.setItem("sheetScale", String(next));
  };

  return (
    <div className="w-full px-2 md:px-4 py-6 md:py-8">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>telc Bereich</CardTitle>
          {savedUrl && (
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={selectedYear}
                    onChange={(e) => onSelectYear(Number(e.target.value))}
                  >
                    {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex justify-center min-w-0">
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
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
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => changeScale(-0.05)}>-</Button>
                  <div className="text-xs w-10 text-center select-none">{Math.round(scale * 100)}%</div>
                  <Button variant="outline" size="sm" onClick={() => changeScale(0.05)}>+</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    onClick={() => { if (typeof window !== "undefined" && savedUrl) window.open(savedUrl, "_blank", "noopener,noreferrer"); }}
                  >
                    Open in Google Sheets
                  </Button>
                </div>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddOpen(true)}
                >
                  Person hinzufügen
                </Button>
                <Button
                  onClick={() => { if (typeof window !== "undefined" && savedUrl) window.open(savedUrl, "_blank", "noopener,noreferrer"); }}
                >
                  Prüfung hinzufügen
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { if (typeof window !== "undefined" && savedUrl) window.open(savedUrl, "_blank", "noopener,noreferrer"); }}
                >
                  Prüfung verschieben
                </Button>
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
          ) : tabsLoaded && tabs.length > 0 && !hasMatch ? (
            <div className="h-[85vh] flex items-center justify-center text-xl text-muted-foreground select-none">keine Daten</div>
          ) : embedUrl ? (
            <div className="relative rounded-lg border border-border overflow-hidden shadow-sm" style={{ height: "85vh" }}>
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: `${100 / scale}%`,
                  height: `${85 / scale}vh`,
                }}
              >
                <iframe
                  title="Google Sheet"
                  src={embedUrl}
                  className="w-full h-full bg-white dark:bg-neutral-900"
                  loading="lazy"
                />
              </div>
            </div>
          ) : valuesLoading ? (
            <div className="h-[85vh] flex items-center justify-center text-sm text-muted-foreground">Lädt…</div>
          ) : (
            <div className="h-[85vh] flex items-center justify-center text-xl text-muted-foreground select-none">keine Daten</div>
          )}
        </CardContent>
      </Card>
      {savedUrl && selectedTab && (
        <AddPersonDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          sheetId={parseSheetId(savedUrl)}
          sheetTitle={selectedTab?.title || null}
          headers={(values && values[0]) ? values[0] : null}
          apiAvailable={apiOk}
          apiBase={apiBase}
          onAppended={() => setRefreshTick((x) => x + 1)}
        />
      )}
    </div>
  );
}
