import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FetchOrdersResponse, OrderFetchResult } from "@shared/api";

const parseOrderNumbers = (text: string): string[] => {
  const ids = Array.from(text.matchAll(/[0-9]{2,}/g)).map((m) => m[0]);
  return Array.from(new Set(ids));
};

const requestSchema = z.object({ orderIds: z.array(z.union([z.string(), z.number()])).min(1) });

export default function Index() {
  const [input, setInput] = useState("");
  const [orders, setOrders] = useState<OrderFetchResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const ids = useMemo(() => parseOrderNumbers(input), [input]);

  const mutation = useMutation({
    mutationFn: async (ids: (string | number)[]) => {
      const body = requestSchema.parse({ orderIds: ids });
      const res = await fetch("/api/orders/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      return (await res.json()) as FetchOrdersResponse;
    },
    onSuccess: (data) => {
      setOrders(data.results);
      toast({ title: "Fetch complete", description: `${data.okCount} succeeded, ${data.errorCount} failed.` });
    },
    onError: (e: any) => toast({ title: "Failed to fetch orders", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    setInput((prev) => prev + (prev ? "\n" : "") + text);
  };

  const onFilePick = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setInput((prev) => prev + (prev ? "\n" : "") + text);
  };

  const exportCsv = () => {
    if (!orders) return;
    const headers = ["id", "number", "status", "total", "currency", "customerName", "email", "phone", "createdAt", "paymentMethod", "link"];
    const rows = orders
      .map((r) => (r.ok ? r.order : null))
      .filter(Boolean)
      .map((o) => headers.map((h) => JSON.stringify((o as any)[h] ?? ""))) as string[][];
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="mb-10 md:mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/60 dark:bg-white/5 px-3 py-1 text-xs md:text-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Language School Operations
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            WooCommerce Order Lookup
          </h1>
          <p className="mt-3 md:mt-4 text-muted-foreground max-w-2xl mx-auto">
            Paste or drop a .txt file with order numbers. We’ll fetch details securely using your WooCommerce API credentials.
          </p>
        </div>

        <Card className="border-2 border-dashed">
          <CardHeader>
            <CardTitle>Input order numbers</CardTitle>
            <CardDescription>Paste them, type manually, or drop a .txt file</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste">
              <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                <TabsTrigger value="paste">Paste/Type</TabsTrigger>
                <TabsTrigger value="upload">Upload .txt</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-4">
                <div className="space-y-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. 10234\n10235\n10236"
                    className="w-full min-h-[160px] rounded-md border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">
                      Detected <span className="font-semibold text-foreground">{ids.length}</span> unique IDs
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setInput("")}>Clear</Button>
                      <Button disabled={ids.length === 0 || mutation.isPending} onClick={() => mutation.mutate(ids)}>
                        {mutation.isPending ? "Fetching..." : "Fetch orders"}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex items-center justify-center h-40 rounded-md border-2 border-dashed transition-colors",
                    dragOver ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <div className="text-center px-4">
                    <p className="text-sm md:text-base">
                      Drop a .txt file here or
                      <Button variant="link" className="pl-1" onClick={() => fileInputRef.current?.click()}>
                        choose file
                      </Button>
                    </p>
                    <p className="text-xs text-muted-foreground">We only read text content locally before sending IDs.</p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={(e) => onFilePick(e.target.files?.[0])}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                {ids.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No IDs detected yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
                    {ids.map((id) => (
                      <Badge key={id} variant="secondary">{id}</Badge>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-10">
          {orders ? (
            <ResultsTable results={orders} onExport={exportCsv} />
          ) : (
            <div className="text-center text-sm text-muted-foreground">Results will appear here after fetching.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ results, onExport }: { results: OrderFetchResult[]; onExport: () => void }) {
  const ok = results.filter((r) => r.ok) as Extract<OrderFetchResult, { ok: true }>[];
  const failed = results.filter((r) => !r.ok) as Extract<OrderFetchResult, { ok: false }>[],
    total = results.length;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {ok.length} succeeded, {failed.length} failed, {total} total
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExport} disabled={ok.length === 0}>Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ok.map(({ order }) => (
              <tr key={order.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3 font-mono">{order.number}</td>
                <td className="py-2 pr-3">{order.customerName || <span className="text-muted-foreground">Unknown</span>}</td>
                <td className="py-2 pr-3">
                  <Badge className="uppercase">{order.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  {order.total} {order.currency}
                </td>
                <td className="py-2 pr-3">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-2">
                    <a href={order.link} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">Open in Woo</Button>
                    </a>
                    <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(order.number.toString())}>Copy ID</Button>
                  </div>
                </td>
              </tr>
            ))}
            {failed.map((r) => (
              <tr key={`err-${r.id}`} className="border-b last:border-b-0 bg-destructive/5">
                <td className="py-2 pr-3 font-mono">{r.id}</td>
                <td className="py-2 pr-3" colSpan={3}>
                  <span className="text-destructive">Failed</span> — {r.error}
                </td>
                <td className="py-2 pr-3" colSpan={2}>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(r.id.toString())}>Copy ID</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
