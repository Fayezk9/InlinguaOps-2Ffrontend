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
    }
    if (saEmail && saKey) {
      await fetch("/api/sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_email: saEmail.trim(), private_key: saKey }),
      }).catch(() => {});
    }
    setShowForm(false);
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
                </div>
                {current && (
                  <div className="text-sm text-muted-foreground truncate text-center">{current}</div>
                )}
                {showForm && (
                  <div className="mt-2 rounded-md border border-border bg-card/50 p-4 space-y-3">
                    <div className="grid gap-2">
                      <Input placeholder="Google Sheet URL or ID" value={sheetUrl} onChange={(e)=>setSheetUrl(e.target.value)} />
                      <Input placeholder="Service account email" value={saEmail} onChange={(e)=>setSaEmail(e.target.value)} />
                      <Textarea placeholder="Service account private key (BEGIN PRIVATE KEY ... END PRIVATE KEY)" value={saKey} onChange={(e)=>setSaKey(e.target.value)} className="min-h-[120px]" />
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
