import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Section = "none" | "sheets" | "sprache" | "emails" | "background";

export default function Settings() {
  const [current, setCurrent] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("none");
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrent(localStorage.getItem("telcSheetUrl"));
  }, []);

  const setOrChange = () => {
    const v = typeof window !== "undefined" ? window.prompt("Paste Google Sheet URL")?.trim() : "";
    if (!v) return;
    localStorage.setItem("telcSheetUrl", v);
    setCurrent(v);
  };

  const openInApp = () => {
    if (!current) return setOrChange();
    navigate("/telc");
  };

  const openExternal = () => {
    if (!current) return setOrChange();
    if (typeof window !== "undefined") window.open(current, "_blank", "noopener,noreferrer");
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
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <aside className="border border-border rounded-lg bg-card dark:bg-black dark:border-neutral-800">
              <nav className="p-2 space-y-2">
                <button onClick={() => setSection("sprache")} className="flex w-full items-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Sprache</button>
                <button onClick={() => setSection("sheets")} className="flex w-full items-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Google Sheets</button>
                <button onClick={() => setSection("emails")} className="flex w-full items-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Emails</button>
                <button onClick={() => setSection("background")} className="flex w-full items-center rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">Background Foto</button>
              </nav>
            </aside>
            <main>
              {section === "sheets" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={setOrChange}>Set / Change Google Sheet</Button>
                    <Button variant="secondary" onClick={openInApp} disabled={!current}>Open in telc Bereich</Button>
                    <Button variant="outline" onClick={openExternal} disabled={!current}>Open Google Sheet</Button>
                    <Button variant="outline" onClick={clear} disabled={!current}>Clear Google Sheet</Button>
                  </div>
                  {current && (
                    <div className="text-sm text-muted-foreground truncate">{current}</div>
                  )}
                </div>
              ) : null}
            </main>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
