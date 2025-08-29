import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const [input, setInput] = useState("");
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrent(localStorage.getItem("telcSheetUrl"));
  }, []);

  const save = () => {
    const v = input.trim();
    if (!v) return;
    localStorage.setItem("telcSheetUrl", v);
    setCurrent(v);
    setInput("");
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
          <CardDescription>Configure integrations and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h4 className="text-lg font-bold mb-2">Google Sheet (telc Bereich)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Paste your Google Sheet link here. We will show it inside the telc Bereich page. To keep private access,
              consider connecting with a service account later; for now we use your provided link.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button onClick={save} disabled={!input.trim()}>Save</Button>
            </div>
            {current ? (
              <div className="mt-3 text-sm">
                <div className="text-muted-foreground">Current:</div>
                <div className="truncate">{current}</div>
                <div className="mt-2 flex gap-2">
                  <a href={current} target="_blank" rel="noreferrer">
                    <Button variant="secondary">Open</Button>
                  </a>
                  <Button variant="outline" onClick={clear}>Clear</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">No sheet set.</div>
            )}
          </section>

          <section>
            <h4 className="text-lg font-bold mb-2">WooCommerce</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Set environment variables WC_BASE_URL, WC_CONSUMER_KEY and WC_CONSUMER_SECRET to enable live fetching.
              </p>
              <p>
                We recommend using environment variables in the deployment platform. You can set them via the dev server controls if needed.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
