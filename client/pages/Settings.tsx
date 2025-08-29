import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, ExternalLink, Trash2, FileSpreadsheet } from "lucide-react";

export default function Settings() {
  const [current, setCurrent] = useState<string | null>(null);
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
          <CardDescription>Quick actions</CardDescription>
        </CardHeader>
        <CardContent>
          <nav className="p-2 space-y-2">
            <button onClick={setOrChange} className="flex items-center gap-3 rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">
              <Link2 className="h-4 w-4" />
              <span className="text-sm">Set / Change Google Sheet</span>
            </button>
            <button onClick={openInApp} className="flex items-center gap-3 rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm">Open in telc Bereich</span>
            </button>
            <button onClick={openExternal} className="flex items-center gap-3 rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm">Open Google Sheet</span>
            </button>
            <button onClick={clear} className="flex items-center gap-3 rounded-md px-3 py-2 border transition-colors text-foreground hover:bg-neutral-100 border-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:border-neutral-800">
              <Trash2 className="h-4 w-4" />
              <span className="text-sm">Clear Google Sheet</span>
            </button>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
