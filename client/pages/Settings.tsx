import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Section = "none" | "sheets" | "sprache" | "emails" | "background";

export default function Settings() {
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
        // Back-compat: strings -> objects
        const normalized: SavedSheet[] = arr.map((it: any) =>
          typeof it === "string" ? { url: it } : { url: String(it.url || ""), saEmail: it.saEmail || undefined },
        ).filter((it: SavedSheet) => it.url);
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
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <nav className="w-full max-w-sm p-2 space-y-2">
              <button onClick={() => setSection("sprache")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Sprache</button>
              <button onClick={() => setSection("sheets")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Google Sheets</button>
              <button onClick={() => setSection("emails")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Emails</button>
              <button onClick={() => setSection("background")} className="flex w-full items-center justify-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Background Foto</button>
            </nav>
          </div>
        </CardContent>
      </Card>

      {section !== "none" && (
        <div ref={panelRef}>
          <Card className="mt-4 border border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>{section === "sheets" ? "Google Sheets" : section === "sprache" ? "Sprache" : section === "emails" ? "Emails" : "Background Foto"}</CardTitle>
            </CardHeader>
            <CardContent>
              {section === "sheets" ? (
              <div className="w-full max-w-3xl mx-auto space-y-3">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={setOrChange}>Set / Change Google Sheet</Button>
                  <Button variant="secondary" onClick={openInApp} disabled={!current}>Open in telc Bereich</Button>
                  <Button variant="outline" onClick={openExternal} disabled={!current}>Open Google Sheet</Button>
                  <Button variant="outline" onClick={clear} disabled={!current}>Clear Google Sheet</Button>
                  <Button variant="outline" onClick={()=>setShowSaved((v)=>!v)}>{showSaved ? "Hide Saved" : "Saved Google Sheets"}</Button>
                </div>
                {current && (
                  <div className="text-sm text-muted-foreground truncate text-center">{current}</div>
                )}
                {showSaved && (
                  <div className="mt-3 rounded-md border border-border p-3 space-y-2">
                    {savedList.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center">No saved sheets yet.</div>
                    ) : (
                      savedList.map((s) => (
                        <div key={s.url} className="flex items-center gap-2">
                          <div className="flex-1 truncate text-sm">{s.url}</div>
                          <Button size="sm" variant="secondary" onClick={()=>{localStorage.setItem("telcSheetUrl", s.url); setCurrent(s.url);}}>Use</Button>
                          <Button size="sm" variant="outline" onClick={()=>{setSheetUrl(s.url); setSaEmail(s.saEmail || localStorage.getItem("telcSaEmail") || ""); setShowForm(true);}}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={()=>{const next=savedList.filter((x)=>x.url!==s.url); persistSaved(next); if (current===s.url){localStorage.removeItem("telcSheetUrl"); setCurrent(null);} }}>Delete</Button>
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
                      <Button onClick={saveInline}>Save</Button>
                      <Button variant="outline" onClick={()=>setShowForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
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
