import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export type OrdersListRow = {
  id: number;
  number: string;
  billingFirstName: string;
  billingLastName: string;
  examKind: string;
  examPart?: string;
  bookingDate?: string;
  examDate: string; // YYYY-MM-DD or similar
  paymentMethod: string;
};

function toDDMMYYYY(s?: string): string {
  if (!s) return "";
  const str = String(s);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return str;
}

function monthKeyFromISO(s: string): string | null {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!m) return null;
  return `${m[2]}.${m[1]}`; // MM.YYYY
}

function normalizeDigitsTitle(title: string): string {
  const only = String(title || "").replace(/[^0-9]+/g, ".");
  return only.replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
}

function findMonthlySheetTitle(tabs: { title: string; gid: string; index?: number }[], key: string): string | null {
  // Accept variants like MM.YYYY and M.YYYY
  const [mm, yyyy] = key.split(".");
  const m1 = String(Number(mm));
  const patterns = new Set([`${mm}.${yyyy}`, `${m1}.${yyyy}`, `${yyyy}.${mm}`, `${yyyy}.${m1}`]);
  for (const t of tabs) {
    const n = normalizeDigitsTitle(t.title);
    if (patterns.has(n)) return t.title;
  }
  return null;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apiBase: string; // e.g. "/api" or "/.netlify/functions/api"
  sheetId: string; // parsed ID
  tabs: { title: string; gid: string; index?: number }[];
  onAppended?: () => void;
};

const PAGE_SIZE = 20;

export default function AddOrdersToListDialog({ open, onOpenChange, apiBase, sheetId, tabs, onAppended }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<"new" | "old">("new");
  const [rows, setRows] = useState<OrdersListRow[]>([]);
  const [page, setPage] = useState(1);
  const [apiPageOld, setApiPageOld] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedMap, setSelectedMap] = useState<Record<number, OrdersListRow>>({});

  useEffect(() => {
    if (!open) {
      setRows([]);
      setSelectedIds(new Set());
      setSelectedMap({});
      setError(null);
      setLoading(false);
      setPage(1);
      setApiPageOld(1);
      setTab("new");
    }
  }, [open]);

  const fetchJSON = async (url: string, opts: RequestInit) => {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadNew = async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = localStorage.getItem("lastOrdersCheck");
      const parsed = stored ? new Date(stored) : null;
      const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const data = await fetchJSON(`${apiBase}/orders/recent-detailed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      const list: OrdersListRow[] = Array.isArray(data.results) ? data.results : [];
      setRows(list);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      toast({ title: t("newOrders", "New Orders"), description: e?.message || "Failed to load", variant: "destructive" });
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
      const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
      const pageToLoad = opts?.append ? apiPageOld + 1 : 1;
      const data = await fetchJSON(`${apiBase}/orders/old-detailed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since, page: pageToLoad, pageSize: PAGE_SIZE }),
      });
      const list: OrdersListRow[] = Array.isArray(data.results) ? data.results : [];
      if (opts?.append) {
        setRows((prev) => [...prev, ...list]);
        setApiPageOld(pageToLoad);
      } else {
        setRows(list);
        setApiPageOld(1);
        setPage(1);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      toast({ title: t("oldOrders", "Old Orders"), description: e?.message || "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (tab === "new") void loadNew();
    else void loadOld({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length]);
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const toggleId = (id: number, row?: OrdersListRow) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (row) setSelectedMap((prev) => ({ ...prev, [id]: row }));
  };

  const allCheckedOnPage = paged.every((r) => selectedIds.has(r.id));
  const toggleAllOnPage = () => {
    if (allCheckedOnPage) {
      const idsOnPage = new Set(paged.map((r) => r.id));
      setSelectedIds((prev) => new Set([...prev].filter((id) => !idsOnPage.has(id))));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paged.forEach((r) => next.add(r.id));
        return next;
      });
      setSelectedMap((prev) => ({ ...prev, ...Object.fromEntries(paged.map((r) => [r.id, r])) }));
    }
  };

  const selectedRows: OrdersListRow[] = useMemo(() => {
    return [...selectedIds].map((id) => selectedMap[id]).filter(Boolean);
  }, [selectedIds, selectedMap]);

  const HEADER = [
    "B.Nr", "Nachname", "Vorname", "Geb.Datum", "Geburtsort", "Geburtsland", "Email", "Tel.Nr.",
    "Prüfung", "Prüfungsteil", "Zertifikat", "P.Datum", "B.Datum", "Zahlung", "Preis", "Status", "Mitarbeiter",
  ];

  const buildRow = (r: OrdersListRow): string[] => {
    const bn = String(r.number || r.id);
    const nach = r.billingLastName || "";
    const vor = r.billingFirstName || "";
    const gebDat = "";
    const gebOrt = "";
    const gebLand = "";
    const email = "";
    const tel = "";
    const pruefung = r.examKind || "";
    const teil = r.examPart || "";
    const zert = "";
    const pDatum = toDDMMYYYY(r.examDate);
    const bDatum = toDDMMYYYY(r.bookingDate);
    const zahlung = r.paymentMethod || "";
    const preis = "";
    const status = "Offen";
    const mitarbeiter = "Fayez";
    return [bn, nach, vor, gebDat, gebOrt, gebLand, email, tel, pruefung, teil, zert, pDatum, bDatum, zahlung, preis, status, mitarbeiter];
  };

  const appendRow = async (title: string, row: string[]) => {
    await fetch(`${apiBase}/sheets/append`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sheetId, title, row }),
    }).then((r) => {
      if (!r.ok) throw new Error(`Append failed ${r.status}`);
    });
  };

  const onAddToList = async () => {
    if (selectedRows.length === 0) {
      toast({ title: "Nothing selected", description: "Select one or more orders", variant: "destructive" });
      return;
    }
    try {
      // Group by target monthly sheet title key MM.YYYY
      const byMonth: Record<string, OrdersListRow[]> = {};
      for (const r of selectedRows) {
        const key = monthKeyFromISO(r.examDate);
        if (!key) continue;
        (byMonth[key] ||= []).push(r);
      }

      const monthKeys = Object.keys(byMonth);
      if (monthKeys.length === 0) throw new Error("No exam dates found in selection");

      for (const key of monthKeys) {
        const title = findMonthlySheetTitle(tabs, key);
        if (!title) throw new Error(`Sheet for ${key} not found`);
        // Sort by exam date ascending
        const group = byMonth[key].slice().sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
        for (let i = 0; i < group.length; i++) {
          await appendRow(title, buildRow(group[i]));
        }
        // After the group, insert two empty rows and repeat header for next time
        await appendRow(title, [""]);
        await appendRow(title, [""]);
        await appendRow(title, HEADER);
      }

      toast({ title: "Added", description: `Appended ${selectedRows.length} rows` });
      onOpenChange(false);
      onAppended?.();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Could not append rows", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("searchOrders", "Search Orders")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant={tab === "new" ? "default" : "outline"} size="sm" onClick={() => setTab("new")}>New</Button>
            <Button variant={tab === "old" ? "default" : "outline"} size="sm" onClick={() => setTab("old")}>Old</Button>
          </div>
          <div className="text-sm text-muted-foreground">{selectedIds.size} selected</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allCheckedOnPage} onCheckedChange={toggleAllOnPage} /></TableHead>
                <TableHead className="whitespace-nowrap">{t("orderNumber", "Order Number")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("lastName", "Sur Name")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("firstName", "First Name")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("examKind", "Exam kind")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("examPart", "Prüfungsteil")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("bookingDateFull", "Buchungsdatum")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("examDate", "Exam Date")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("paymentMethod", "Paying Method")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9}>{t("searching", "Loading...")}</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={9} className="text-red-500 text-sm">{error}</TableCell></TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="w-10">
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleId(r.id, r)} />
                    </TableCell>
                    <TableCell>{r.number}</TableCell>
                    <TableCell>{r.billingLastName}</TableCell>
                    <TableCell>{r.billingFirstName}</TableCell>
                    <TableCell>{r.examKind}</TableCell>
                    <TableCell>{r.examPart || ""}</TableCell>
                    <TableCell>{toDDMMYYYY(r.bookingDate)}</TableCell>
                    <TableCell>{toDDMMYYYY(r.examDate)}</TableCell>
                    <TableCell>{r.paymentMethod}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-muted-foreground">{rows.length} {t("searchResults", "Search Results")}</div>
          <div className="flex items-center gap-2">
            {tab === "old" && (
              <>
                <Button variant="outline" size="sm" onClick={() => loadOld({ append: false })} disabled={loading}>Reload</Button>
                <Button variant="outline" size="sm" onClick={() => loadOld({ append: true })} disabled={loading}>More</Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Prev</Button>
            <div className="text-sm">Page {page} / {pageCount}</div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || loading}>Next</Button>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close", "Close")}</Button>
          <Button onClick={onAddToList} disabled={selectedRows.length === 0}>{t("addToList", "Add to List")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
