import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

type Section = "none" | "sheets" | "sprache" | "emails" | "background" | "orders" | "exams";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const [current, setCurrent] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("none");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrent(localStorage.getItem("telcSheetUrl"));
  }, []);

  useEffect(() => {
    if (section === "none") return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSection("none");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [section]);

  const [showForm, setShowForm] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [saKey, setSaKey] = useState("");
  type SavedSheet = { url: string; saEmail?: string };
  const [savedList, setSavedList] = useState<SavedSheet[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("telcSheets");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const normalized: SavedSheet[] = arr
          .map((it: any) => (typeof it === "string" ? { url: it } : { url: String(it.url || ""), saEmail: it.saEmail || undefined }))
          .filter((it: SavedSheet) => it.url);
        setSavedList(normalized);
      }
      const storedEmail = localStorage.getItem("telcSaEmail");
      if (storedEmail && !saEmail) setSaEmail(storedEmail);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSaved = (list: SavedSheet[]) => {
    setSavedList(list);
    localStorage.setItem("telcSheets", JSON.stringify(list));
  };

  const setOrChange = () => {
    if (section !== "sheets") setSection("sheets");
    setSheetUrl(current ?? "");
    setShowForm(true);
  };

  const openInApp = () => {
    if (!current) return setOrChange();
    navigate("/telc");
  };

  const openExternal = () => {
    if (!current) return setOrChange();
    if (typeof window !== "undefined") window.open(current, "_blank", "noopener,noreferrer");
  };

  const parseSheetId = (input: string) => {
    try {
      const u = new URL(input);
      const p = u.pathname.split("/");
      const dIdx = p.indexOf("d");
      return dIdx >= 0 ? p[dIdx + 1] : input;
    } catch {
      return input;
    }
  };

  const saveInline = async () => {
    const url = sheetUrl.trim();
    if (url) {
      localStorage.setItem("telcSheetUrl", url);
      setCurrent(url);
      const next = [...savedList];
      const idx = next.findIndex((s) => s.url === url);
      if (idx >= 0) next[idx] = { url, saEmail: saEmail.trim() || next[idx].saEmail };
      else next.push({ url, saEmail: saEmail.trim() || undefined });
      persistSaved(next);
    }
    if (saEmail) localStorage.setItem("telcSaEmail", saEmail.trim());
    if (saEmail && saKey) {
      await fetch("/api/sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_email: saEmail.trim(), private_key: saKey }),
      }).catch(() => {});
    }
    setShowForm(false);
    setSaKey("");
  };

  const clear = () => {
    localStorage.removeItem("telcSheetUrl");
    setCurrent(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{t('settings','Settings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <nav className="w-full max-w-sm p-2 space-y-2">
              <button onClick={() => setSection("sprache")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">{t('language','Language')}</button>
              <button onClick={() => setSection("sheets")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">{t('googleSheets','Google Sheets')}</button>
              <button onClick={() => setSection("orders")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Orders</button>
              <button onClick={() => setSection("exams")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Exams Management</button>
              <button onClick={() => setSection("emails")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">{t('emails','Emails')}</button>
              <button onClick={() => setSection("background")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">{t('backgroundPhoto','Background Photo')}</button>
            </nav>
          </div>
        </CardContent>
      </Card>

      {section !== "none" && (
        <div ref={panelRef}>
          <Card className="mt-4 border border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>{section === "sheets" ? t('googleSheets','Google Sheets') : section === "sprache" ? t('language','Language') : section === "emails" ? t('emails','Emails') : section === "orders" ? 'Orders' : section === 'exams' ? 'Exams Management' : t('backgroundPhoto','Background Photo')}</CardTitle>
            </CardHeader>
            <CardContent>
              {section === "sheets" ? (
              <div className="w-full max-w-3xl mx-auto space-y-3">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={setOrChange}>{t('setChangeGoogleSheet','Set / Change Google Sheet')}</Button>
                  <Button variant="secondary" onClick={openInApp} disabled={!current}>{t('openInTelc','Open in telc area')}</Button>
                  <Button variant="outline" onClick={openExternal} disabled={!current}>{t('openGoogleSheet','Open Google Sheet')}</Button>
                  <Button variant="outline" onClick={clear} disabled={!current}>{t('clearGoogleSheet','Clear Google Sheet')}</Button>
                  <Button variant="outline" onClick={()=>setShowSaved((v)=>!v)}>{showSaved ? t('hideSaved','Hide Saved') : t('savedGoogleSheets','Saved Google Sheets')}</Button>
                </div>
                {current && (
                  <div className="text-sm text-muted-foreground truncate text-center">{current}</div>
                )}
                {showSaved && (
                  <div className="mt-3 rounded-md border border-border p-3 space-y-2">
                    {savedList.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center">{t('noSavedSheetsYet','No saved sheets yet.')}</div>
                    ) : (
                      savedList.map((s) => (
                        <div key={s.url} className="flex items-center gap-2">
                          <div className="flex-1 truncate text-sm">{s.url}</div>
                          <Button size="sm" variant="secondary" onClick={()=>{localStorage.setItem("telcSheetUrl", s.url); setCurrent(s.url);}}>{t('use','Use')}</Button>
                          <Button size="sm" variant="outline" onClick={()=>{setSheetUrl(s.url); setSaEmail(s.saEmail || localStorage.getItem("telcSaEmail") || ""); setShowForm(true);}}>{t('edit','Edit')}</Button>
                          <Button size="sm" variant="outline" onClick={()=>{const next=savedList.filter((x)=>x.url!==s.url); persistSaved(next); if (current===s.url){localStorage.removeItem("telcSheetUrl"); setCurrent(null);} }}>{t('delete','Delete')}</Button>
                        </div>
                      ))
                    )}
                    <p className="text-xs text-muted-foreground">For security, the private key isn’t stored or shown. Re-enter it when changing credentials.</p>
                  </div>
                )}
                {showForm && (
                  <div className="mt-2 rounded-md border border-border bg-card/50 p-4 space-y-3">
                    <div className="grid gap-2">
                      <Input placeholder="Google Sheet URL or ID" value={sheetUrl} onChange={(e)=>setSheetUrl(e.target.value)} />
                      <Input placeholder="Service account email" value={saEmail} onChange={(e)=>setSaEmail(e.target.value)} />
                      <Textarea placeholder="Service account private key (BEGIN PRIVATE KEY ... END PRIVATE KEY) — not stored, re-enter to update" value={saKey} onChange={(e)=>setSaKey(e.target.value)} className="min-h-[120px]" />
                      <p className="text-xs text-muted-foreground text-center">Grant the service account email view access to the sheet in Google Drive.</p>
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button onClick={saveInline}>{t('save','Save')}</Button>
                      <Button variant="outline" onClick={()=>setShowForm(false)}>{t('cancel','Cancel')}</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : section === 'orders' ? (
              <OrdersPanel current={current} />
            ) : section === 'exams' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex items-center gap-2">
                  <Button onClick={()=>{ if (typeof window !== 'undefined' && current) window.open(current, '_blank', 'noopener,noreferrer'); }} disabled={!current}>Prüfung hinzufügen</Button>
                  <Button variant="secondary" onClick={()=>{ if (typeof window !== 'undefined' && current) window.open(current, '_blank', 'noopener,noreferrer'); }} disabled={!current}>Prüfung verschieben</Button>
                </div>
                {!current && <div className="text-sm text-muted-foreground">Connect Google Sheet first in Settings → Google Sheets.</div>}
              </div>
            ) : section === 'sprache' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex gap-2">
                  <Button variant={lang==='de' ? 'default' : 'outline'} onClick={()=>setLang('de')}>{t('german','German')}</Button>
                  <Button variant={lang==='en' ? 'default' : 'outline'} onClick={()=>setLang('en')}>{t('english','English')}</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-6">Content coming soon.</div>
            )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Helpers and Orders panel
function normalizeHeader(h: string) {
  return String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFlexibleToDDMMYYYY(input: string): string | null {
  const s = String(input || "").trim();
  const m1 = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m1) {
    const dd = Math.max(1, Math.min(31, Number(m1[1])));
    const mm = Math.max(1, Math.min(12, Number(m1[2])));
    const yyyy = Number(m1[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${String(dd).padStart(2,'0')}.${String(mm).padStart(2,'0')}.${yyyy}`;
    return null;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    const dd = Number(digits.slice(0,2));
    const mm = Number(digits.slice(2,4));
    const yyyy = Number(digits.slice(4));
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${String(dd).padStart(2,'0')}.${String(mm).padStart(2,'0')}.${yyyy}`;
  }
  return null;
}

function onlyDigits(s: string) { return String(s||"").replace(/\D+/g, ""); }

function colIndexToA1(index0: number): string {
  let n = index0 + 1; let s = "";
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function createSimplePdf(lines: string[]): Blob {
  const header = `%PDF-1.4\n`;
  const content = lines.map(l => l.replace(/\r|\n/g, '')).join("\n");
  const stream = `BT /F1 10 Tf 50 780 Td 12 TL (${content.replace(/([()\\])/g,'\\$1')}) Tj ET`;
  const streamBytes = new TextEncoder().encode(stream).length;
  const objects = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${streamBytes} >> stream\n${stream}\nendstream endobj\n`,
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`,
  ];
  let xref: number[] = []; let body = header; let offset = header.length;
  for (const obj of objects) { xref.push(offset); body += obj; offset = body.length; }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for (const off of xref) body += `${String(off).padStart(10,'0')} 00000 n \n`;
  body += `trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

function OrdersPanel({ current }: { current: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<Record<string, string[]>>({});

  const parseSheetId = (input: string) => {
    try { const u = new URL(input); const p = u.pathname.split('/'); const dIdx = p.indexOf('d'); return dIdx >= 0 ? p[dIdx + 1] : input; } catch { return input; }
  };

  async function load() {
    if (!current) { setError('No Google Sheet configured.'); return; }
    setLoading(true); setError(null);
    try {
      const sheetId = parseSheetId(current);
      const tabsRes = await fetch(`/api/sheets/tabs?id=${encodeURIComponent(sheetId)}`);
      if (!tabsRes.ok) throw new Error('tabs');
      const tabsJson = await tabsRes.json();
      const tabs: { title: string; gid: string }[] = tabsJson?.sheets || [];
      const out: Record<string, string[]> = {};
      for (const tab of tabs) {
        const sampleRes = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent('A1:ZZ200')}`);
        if (!sampleRes.ok) continue;
        const sampleJson = await sampleRes.json();
        const rows: string[][] = (sampleJson?.values as string[][]) || [];
        if (rows.length === 0) continue;
        const head = rows[0];
        const maxCols = Math.max(head.length, ...rows.map(r=>r.length, 0));
        const orderCandidates = new Set<number>();
        for (let i=0;i<maxCols;i++) {
          const h = normalizeHeader(head[i] || '');
          if (h.includes('bestell') || h.includes('order') || h.includes('b nr') || h.includes('bnr')) orderCandidates.add(i);
        }
        for (let c=0;c<maxCols;c++) {
          for (let r=1;r<rows.length;r++) { const d = onlyDigits(rows[r]?.[c] || ''); if (d.length === 4) { orderCandidates.add(c); break; } }
        }
        let dateIdx = head.findIndex(h=>{ const n = normalizeHeader(h); return n.includes('pdatum') || n.includes('p datum') || n.includes('prufungsdatum') || n.includes('exam date'); });
        if (dateIdx < 0) {
          for (let c=0;c<maxCols && dateIdx<0;c++) {
            for (let r=1;r<rows.length;r++) { if (parseFlexibleToDDMMYYYY(rows[r]?.[c] || '')) { dateIdx=c; break; } }
          }
        }
        if (orderCandidates.size === 0 || dateIdx < 0) continue;
        for (const oc of orderCandidates) {
          const col = colIndexToA1(oc);
          const dcol = colIndexToA1(dateIdx);
          const res = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${col}1:${col}100000`)}`);
          const dres = await fetch(`/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${dcol}1:${dcol}100000`)}`);
          if (!res.ok || !dres.ok) continue;
          const json = await res.json(); const djson = await dres.json();
          const v: any[][] = json?.values || []; const dv: any[][] = djson?.values || [];
          for (let r=1;r<Math.max(v.length, dv.length); r++) {
            const order = onlyDigits(String(v[r]?.[0] ?? ''));
            const date = parseFlexibleToDDMMYYYY(String(dv[r]?.[0] ?? '')) || '';
            if (order.length === 4 && date && !(Number(order) >= 1900 && Number(order) <= 2040)) {
              if (!out[date]) out[date] = [];
              if (!out[date].includes(order)) out[date].push(order);
            }
          }
        }
      }
      for (const k of Object.keys(out)) out[k].sort();
      try {
        const prevRaw = localStorage.getItem('ordersGrouped');
        const prev: Record<string, string[]> = prevRaw ? JSON.parse(prevRaw) : {};
        const prevSet = new Set<string>();
        Object.values(prev).forEach(arr => arr.forEach(v => prevSet.add(v)));
        const currSet = new Set<string>();
        Object.values(out).forEach(arr => arr.forEach(v => currSet.add(v)));
        let added = 0;
        currSet.forEach(v => { if (!prevSet.has(v)) added++; });
        localStorage.setItem('ordersGrouped', JSON.stringify(out));
        if (added > 0) {
          try {
            const { logHistory } = await import('@/lib/history');
            const user = localStorage.getItem('currentUserName') || 'User';
            logHistory({ type: 'orders_update', message: `${user} added ${added} new Orders to the list`, meta: { added } });
          } catch {}
        }
      } catch {}
      setGrouped(out);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
    setLoading(false);
  }

  function downloadPdf() {
    const dates = Object.keys(grouped).sort((a,b)=>{
      const ap = a.split('.').reverse().join('');
      const bp = b.split('.').reverse().join('');
      return ap.localeCompare(bp);
    });
    const lines: string[] = [];
    lines.push('All Orders by Exam Date');
    lines.push('');
    for (const d of dates) { lines.push(`${d}`); lines.push(grouped[d].join(', ')); lines.push(''); }
    const blob = createSimplePdf(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'all-orders-by-exam-date.pdf'; a.click();
    URL.revokeObjectURL(url);
    try {
      import('@/lib/history').then(({ logHistory }) => {
        const user = localStorage.getItem('currentUserName') || 'User';
        logHistory({ type: 'orders_download', message: `${user} downloaded the Orders list as PDF` });
      });
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={load} disabled={!current || loading}>{loading ? 'Loading…' : 'Show list'}</Button>
        <Button variant="outline" onClick={downloadPdf} disabled={Object.keys(grouped).length===0}>Download list</Button>
      </div>
      {!current && <div className="text-sm text-muted-foreground text-center">Connect Google Sheet first in Settings &gt; Google Sheets.</div>}
      {error && <div className="text-sm text-red-500 text-center">{error}</div>}
      {Object.keys(grouped).length>0 && (
        <div className="mt-2 rounded border border-border p-3 max-h-96 overflow-auto themed-scroll">
          {Object.keys(grouped).sort().map(d => (
            <div key={d} className="mb-2">
              <div className="font-semibold">{d}</div>
              <div className="text-sm text-muted-foreground break-words">{grouped[d].join(', ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
