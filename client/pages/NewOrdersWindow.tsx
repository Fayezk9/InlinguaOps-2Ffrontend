import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AddOrdersToListDialog from "@/components/AddOrdersToListDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrderRow = {
  id: number;
  number: string;
  billingFirstName: string;
  billingLastName: string;
  examKind: string;
  examPart?: string;
  bookingDate?: string;
  examDate: string;
  paymentMethod: string;
};

const ROWS_PER_PAGE = 10;

function parseSheetId(input: string): string | null {
  try {
    const u = new URL(input);
    const p = u.pathname.split("/");
    const idx = p.indexOf("d");
    return idx >= 0 ? p[idx + 1] : null;
  } catch {
    if (/^[A-Za-z0-9-_]{20,}$/.test(input)) return input;
    return null;
  }
}

export default function NewOrdersWindow() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "old">("new");

  const [newRows, setNewRows] = useState<OrderRow[]>([]);
  const [oldRows, setOldRows] = useState<OrderRow[]>([]);
  const [oldApiPage, setOldApiPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [addOrdersOpen, setAddOrdersOpen] = useState(false);
  const [apiBase, setApiBase] = useState<string>("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [tabs, setTabs] = useState<{ title: string; gid: string; index?: number }[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") setSavedUrl(localStorage.getItem("telcSheetUrl"));
  }, []);
  useEffect(() => {
    const ping = async (url: string) => {
      try { const r = await fetch(`${url}/ping`); return r.ok; } catch { return false; }
    };
    (async () => {
      if (await ping("/api")) { setApiBase("/api"); return; }
      if (await ping("/.netlify/functions/api")) { setApiBase("/.netlify/functions/api"); return; }
      setApiBase("");
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        setTabs([]);
        const id = savedUrl ? parseSheetId(savedUrl) : null;
        if (!apiBase || !id) return;
        const r = await fetch(`${apiBase}/sheets/tabs?id=${encodeURIComponent(id)}`);
        if (!r.ok) return;
        const j = await r.json();
        const sheets = (j?.sheets || []).filter((s: any) => s?.title && s?.gid);
        setTabs(sheets);
      } catch {}
    })();
  }, [apiBase, savedUrl]);

  useEffect(() => {
    const load = () => {
      try {
        const arr: number[] = JSON.parse(localStorage.getItem("ordersAddedToSheet") || "[]");
        setAddedIds(new Set(arr.map((x) => Number(x))));
      } catch { setAddedIds(new Set()); }
    };
    load();
    const onEvt = () => load();
    window.addEventListener("orders-added-to-sheet", onEvt as any);
    return () => window.removeEventListener("orders-added-to-sheet", onEvt as any);
  }, []);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fetchWithTimeout = async (
    url: string,
    opts: RequestInit = {},
    timeoutMs = 60000,
  ) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      try {
        return await fetch(url, { ...opts, signal: controller.signal });
      } catch (e: any) {
        if (e && e.name === "AbortError") {
          throw new Error("Request timed out");
        }
        throw e;
      }
    } finally {
      clearTimeout(id);
    }
  };

  const apiRequest = async (url: string, opts: RequestInit) => {
    // Retry up to 3 times for network/5xx errors
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetchWithTimeout(url, opts, 120000);
        if (!res.ok) {
          // Retry on 5xx, no retry on 4xx
          if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
          const txt = await res.text().catch(() => "");
          return Promise.reject(new Error(txt || `HTTP ${res.status}`));
        }
        return await res.json();
      } catch (e: any) {
        lastErr = e;
        // Only retry on network errors or aborted/5xx
        // Abort (timeout) will be retried a couple times
        if (attempt < 3) await delay(500 * attempt);
      }
    }
    throw lastErr ?? new Error("Network error");
  };

  const loadNew = async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = localStorage.getItem("lastOrdersCheck");
      const parsed = stored ? new Date(stored) : null;
      const since =
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const data = await apiRequest("/api/orders/recent-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      setNewRows(Array.isArray(data.results) ? data.results : []);
      setPage(1);
    } catch (e: any) {
      console.error("loadNew error", e);
      setError(e?.message ?? "Failed to load");
      toast({
        title: t("newOrders", "New Orders"),
        description: e?.message ?? "Failed to load",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOld = async (opts?: { append?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const stored = localStorage.getItem("lastOrdersCheck");
      const parsed = stored ? new Date(stored) : null;
      const since =
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date().toISOString();
      const pageToLoad = opts?.append ? oldApiPage + 1 : 1;
      const data = await apiRequest("/api/orders/old-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since, page: pageToLoad, pageSize: 20 }),
      });
      const list: OrderRow[] = Array.isArray(data.results) ? data.results : [];
      if (opts?.append) {
        setOldRows((prev) => [...prev, ...list]);
        setOldApiPage(pageToLoad);
      } else {
        setOldRows(list);
        setOldApiPage(1);
        setPage(1);
      }
    } catch (e: any) {
      console.error("loadOld error", e);
      setError(e?.message ?? "Failed to load");
      toast({
        title: t("oldOrders", "Old Orders"),
        description: e?.message ?? "Failed to load",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "new") {
      if (newRows.length === 0) void loadNew();
    } else {
      if (oldRows.length === 0) void loadOld({ append: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const rows = tab === "new" ? newRows : oldRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const paged = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, page]);

  const allOnPage = paged.length > 0 && paged.every((r) => selectedIds.has(r.id));
  const toggleAllOnPage = () => {
    if (allOnPage) {
      const idsOnPage = new Set(paged.map((r) => r.id));
      setSelectedIds((prev) => new Set([...prev].filter((id) => !idsOnPage.has(id))));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paged.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };
  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(pageCount, p + 1));

  const renderBookingDate = (val: string) => {
    const str = String(val ?? "");
    const i = str.indexOf("T");
    const date = i >= 0 ? str.slice(0, i) : str;
    const time = i >= 0 ? str.slice(i) : "";
    return (
      <div className="leading-4" dir="ltr">
        <div className="text-sm" dir="ltr">
          {date}
        </div>
        {time ? (
          <div className="text-xs" dir="ltr">
            {time}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="new">
                  {t("newOrders", "New Orders")}
                </TabsTrigger>
                <TabsTrigger value="old">
                  {t("oldOrders", "Old Orders")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="secondary" onClick={async () => await onAddToListInline()} disabled={selectedIds.size === 0}>
              {t("addToList", "Add to List")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-3 text-sm text-red-500">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPage} onCheckedChange={toggleAllOnPage} />
                  </TableHead>
                  <TableHead className="whitespace-nowrap w-24">
                    {t("orderNumber", "Order Number")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("lastName", "Sur Name")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("firstName", "First Name")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap w-32">
                    {t("examKind", "Exam kind")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("examPart", "Prüfungsteil")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("bookingDateFull", "Buchungsdatum")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("examDate", "Exam Date")}
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    {t("paymentMethod", "Paying Method")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      {t("searching", "Loading...")}
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      {t("noResultsFound", "No Results Found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => {
                    const isAdded = addedIds.has(Number(r.id));
                    const rowCls = isAdded ? "bg-emerald-50 dark:bg-emerald-900/20" : undefined;
                    return (
                      <TableRow key={r.id} className={rowCls}>
                        <TableCell className="w-10"><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleId(r.id)} /></TableCell>
                        <TableCell className="w-24 whitespace-nowrap">{r.number}</TableCell>
                        <TableCell>{r.billingLastName}</TableCell>
                        <TableCell>{r.billingFirstName}</TableCell>
                        <TableCell className="w-32 whitespace-nowrap truncate">{r.examKind}</TableCell>
                        <TableCell>{r.examPart || ""}</TableCell>
                        <TableCell>{renderBookingDate(r.bookingDate)}</TableCell>
                        <TableCell>{r.examDate}</TableCell>
                        <TableCell>{r.paymentMethod}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {rows.length} {t("searchResults", "Search Results")}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  tab === "new" ? loadNew() : loadOld({ append: false })
                }
                disabled={loading}
              >
                Reload
              </Button>
              {tab === "old" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOld({ append: true })}
                  disabled={loading}
                >
                  More
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={prev}
                disabled={page <= 1 || loading}
              >
                Prev
              </Button>
              <div className="text-sm">
                Page {page} / {pageCount}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={next}
                disabled={page >= pageCount || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddOrdersToListDialog
        open={addOrdersOpen}
        onOpenChange={setAddOrdersOpen}
        apiBase={apiBase || "/api"}
        sheetId={((): string => { try { const id = savedUrl ? parseSheetId(savedUrl) : null; return id || ""; } catch { return ""; } })()}
        tabs={tabs}
        onAppended={() => { try { const arr: number[] = JSON.parse(localStorage.getItem("ordersAddedToSheet") || "[]"); setAddedIds(new Set(arr.map((x) => Number(x)))); } catch {} }}
      />
    </div>
  );
}
