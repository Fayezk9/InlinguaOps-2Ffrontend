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
      try {
        if (controller) timeout = window.setTimeout(() => controller.abort(), 2500);
        const r = await fetch("/api/ping", { signal: controller?.signal });
        setApiOk(r.ok);
      } catch {
        setApiOk(false);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    })();
    return () => { if (timeout) clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    (async () => {
      if (!apiOk) { setConfigured(false); return; }
      try {
        const r = await fetch("/api/sheets/status");
        const j = await r.json();
        setConfigured(Boolean(j?.configured));
      } catch {
        setConfigured(false);
      }
    })();
  }, [apiOk]);

  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [tabsError, setTabsError] = useState(false);
  useEffect(() => {
    setTabsLoaded(false);
    setTabsError(false);
    setTabs([]);
    if (!apiOk || !savedUrl || !configured) return;
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
  }, [savedUrl, configured, apiOk]);

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
    if (!apiOk) return;
    if (!configured) return;
    if (!savedUrl) return;
    const id = parseSheetId(savedUrl);
    if (!id) return;
    if (!selectedTab) return;
    setValuesLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/sheets/values?id=${encodeURIComponent(id)}&title=${encodeURIComponent(selectedTab.title)}&range=A1:ZZ1000`);
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
  }, [apiOk, configured, savedUrl, selectedTab, refreshTick]);

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
          ) : values && values.length > 0 ? (
            <div className="relative rounded-lg border border-border overflow-hidden" style={{ height: "85vh" }}>
              <div
                className="overflow-auto"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: `${100 / scale}%`,
                  height: `${85 / scale}vh`,
                }}
              >
                <table className="w-full text-xs whitespace-nowrap border border-border border-collapse table-fixed">
                  {(() => {
                    const headers = values[0] || [];
                    const key = (s: string) => normalize(String(s)).replace(/\s+/g, "");
                    const idxNachname = headers.findIndex((h) => key(h).includes("nachname"));
                    const idxVorname = headers.findIndex((h) => key(h).includes("vorname"));
                    const idxGeburtsort = headers.findIndex((h) => key(h).includes("geburtsort"));
                    const idxGeburtsdatum = headers.findIndex((h) => key(h).includes("geburtsdatum") || key(h).includes("geburtsdat"));
                    const idxPDatum = headers.findIndex((h) => key(h).includes("pdatum"));
                    const idxBDatum = headers.findIndex((h) => key(h).includes("bdatum"));
                    const idxEmail = headers.findIndex((h) => key(h).includes("email") || key(h).includes("e-mail") || key(h).includes("mail"));
                    const idxPruefung = headers.findIndex((h) => {
                      const k = key(h);
                      return k.includes("prufung") && !k.includes("prufungsteil");
                    });
                    const colStyles: Record<number, React.CSSProperties> = {};
                    if (idxNachname >= 0) colStyles[idxNachname] = { width: "110px", maxWidth: "110px" };
                    if (idxVorname >= 0) colStyles[idxVorname] = { width: "100px", maxWidth: "100px" };
                    if (idxGeburtsort >= 0) colStyles[idxGeburtsort] = { width: "110px", maxWidth: "110px" };
                    if (idxGeburtsdatum >= 0) colStyles[idxGeburtsdatum] = { width: "16ch", minWidth: "16ch" };
                    if (idxPDatum >= 0) colStyles[idxPDatum] = { width: "12ch", minWidth: "12ch" };
                    if (idxBDatum >= 0) colStyles[idxBDatum] = { width: "12ch", minWidth: "12ch" };
                    if (idxPruefung >= 0) colStyles[idxPruefung] = { width: "6ch", maxWidth: "6ch" };
                    if (idxEmail >= 0) colStyles[idxEmail] = { width: "120px", maxWidth: "120px" };
                    // Apply saved widths
                    headers.forEach((hh, ii) => {
                      const k = key(hh);
                      const saved = colWidthMap[k];
                      if (typeof saved === "number" && saved > 40) {
                        colStyles[ii] = { width: `${saved}px`, maxWidth: `${saved}px` };
                      }
                    });
                    return (
                      <colgroup>
                        {headers.map((_, i) => (
                          <col key={i} style={colStyles[i]} />
                        ))}
                      </colgroup>
                    );
                  })()}
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-800">
                      {(values[0] || []).map((h, i) => (
                        <th
                          key={i}
                          ref={(el) => { headerRefs.current[i] = el; }}
                          className="px-2 py-1 text-left border border-border truncate relative select-none"
                        >
                          <div className="pr-2">{h}</div>
                          <span
                            onMouseDown={startResize(i)}
                            className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {values.slice(1).map((row, r) => (
                      <tr key={r} className={cn(r % 2 ? "bg-neutral-50/50 dark:bg-neutral-900/20" : "") }>
                        {row.map((c, i) => {
                          const h = (values[0] || [])[i] || "";
                          const k = normalize(String(h));
                          const v = normalize(String(c));
                          let pill = "";
                          if (k.includes("zahlung")) {
                            if (v.includes("bezahlt")) pill = "bg-green-600";
                            else if (v.includes("bar")) pill = "bg-orange-600";
                            else if (v.includes("bank")) pill = "bg-blue-600";
                            else if (v.includes("paypal")) pill = "bg-cyan-600";
                          } else if (k.includes("status")) {
                            if (v.includes("bezahlt")) pill = "bg-green-600";
                            else if (v.includes("offen")) pill = "bg-red-600";
                          } else if (k.includes("zertifikat") || k.includes("prufungsteil")) {
                            if (v.includes("gesamt")) pill = "bg-indigo-600";
                            else if (v.includes("schrift")) pill = "bg-amber-600";
                            else if (v.includes("mund")) pill = "bg-emerald-600";
                            else if (v.includes("post")) pill = "bg-purple-600";
                            else if (v.includes("abholen")) pill = "bg-yellow-600 text-black";
                          }
                          return (
                            <td key={i} className="px-2 py-1 align-top border border-border truncate">
                              {pill ? (
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${pill}`}>{String(c)}</span>
                              ) : (
                                String(c)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : embedUrl && !valuesLoading ? (
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
          onAppended={() => setRefreshTick((x) => x + 1)}
        />
      )}
    </div>
  );
}
