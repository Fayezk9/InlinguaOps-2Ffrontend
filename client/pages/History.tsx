import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import React from "react";
import { clearHistory, getHistory, onHistoryChanged, type HistoryEvent } from "@/lib/history";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function History() {
  const [items, setItems] = React.useState<HistoryEvent[]>([]);

  const refresh = React.useCallback(() => setItems(getHistory()), []);
  React.useEffect(() => {
    refresh();
    return onHistoryChanged(refresh);
  }, [refresh]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>History</CardTitle>
          <Button variant="outline" onClick={() => { clearHistory(); refresh(); }} disabled={items.length === 0}>Clear</Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((e) => (
                <li key={e.id} className="flex items-start gap-3 border-b last:border-b-0 py-2">
                  <div className="flex-1">
                    <div className="text-sm">{e.message}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()} • {formatRelative(e.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
