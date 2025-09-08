import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  examDate: string;
  paymentMethod: string;
};

const ROWS_PER_PAGE = 10;

export default function NewOrdersWindow() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "old">("new");

  const [newRows, setNewRows] = useState<OrderRow[]>([]);
  const [oldRows, setOldRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const safeFetch = async (url: string, opts?: RequestInit) => {
    try {
      return await fetch(url, opts);
    } catch (e: any) {
      console.error("Network fetch failed", url, e);
      throw new Error(e?.message ?? "Network error");
    }
  };

  const loadNew = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem("lastOrdersCheck");
      const since = stored ? new Date(stored).toISOString() : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await safeFetch("/api/orders/recent-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      if (!res || !res.ok) throw new Error(`Failed to load new orders${res ? ` (status ${res.status})` : ""}`);
      const data = await res.json();
      setNewRows(Array.isArray(data.results) ? data.results : []);
      setPage(1);
    } catch (e: any) {
      console.error("loadNew error", e);
      toast({ title: t("newOrders", "New Orders"), description: e?.message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadOld = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem("lastOrdersCheck");
      const since = stored ? new Date(stored).toISOString() : new Date().toISOString();
      const res = await safeFetch("/api/orders/old-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      if (!res || !res.ok) throw new Error(`Failed to load old orders${res ? ` (status ${res.status})` : ""}`);
      const data = await res.json();
      setOldRows(Array.isArray(data.results) ? data.results : []);
      setPage(1);
    } catch (e: any) {
      console.error("loadOld error", e);
      toast({ title: t("oldOrders", "Old Orders"), description: e?.message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "new") {
      if (newRows.length === 0) void loadNew();
    } else {
      if (oldRows.length === 0) void loadOld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const rows = tab === "new" ? newRows : oldRows;
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const paged = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, page]);

  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(pageCount, p + 1));

  const renderBookingDate = (val: string) => {
    const str = String(val ?? "");
    const i = str.indexOf("T");
    const date = i >= 0 ? str.slice(0, i) : str;
    const time = i >= 0 ? str.slice(i) : "";
    return (
      <div className="leading-4">
        <div className="text-sm">{date}</div>
        {time ? <div className="text-xs">{time}</div> : null}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="flex flex-col gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="new">{t("newOrders", "New Orders")}</TabsTrigger>
              <TabsTrigger value="old">{t("oldOrders", "Old Orders")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("orderNumber", "Order Number")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("lastName", "Sur Name")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("firstName", "First Name")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("examPart", "Prüfungsteil")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("bookingDateFull", "Buchungsdatum")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("examDate", "Exam Date")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("paymentMethod", "Paying Method")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7}>{t("searching", "Loading...")}</TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>{t("noResultsFound", "No Results Found")}</TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.number}</TableCell>
                      <TableCell>{r.billingLastName}</TableCell>
                      <TableCell>{r.billingFirstName}</TableCell>
                      <TableCell>{r.examPart || r.examKind}</TableCell>
                      <TableCell>{renderBookingDate(r.bookingDate)}</TableCell>
                      <TableCell>{r.examDate}</TableCell>
                      <TableCell>{r.paymentMethod}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {rows.length} {t("searchResults", "Search Results")}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prev} disabled={page <= 1 || loading}>
                Prev
              </Button>
              <div className="text-sm">
                Page {page} / {pageCount}
              </div>
              <Button variant="outline" size="sm" onClick={next} disabled={page >= pageCount || loading}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
