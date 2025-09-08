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

function monthKeyFromDate(s: string): string | null {
  const str = String(s || "");
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}.${m[1]}`;
  m = str.match(/^(\d{2})[.](\d{2})[.](\d{4})/);
  if (m) return `${m[2]}.${m[3]}`;
  return null;
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

const PAGE_SIZE = 10;

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

  const normalizeBirthday = (raw: any): string => {
    if (!raw) return "";
    const s = String(raw).trim();
    const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`;
    return toDDMMYYYY(s);
  };
  const norm = (s: string) => s
    .toLowerCase()
    .trim()
    .replace(/:$/u, "")
    .replace(/\(.*?\)/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const getFromMeta = (meta: Record<string, any>, keys: string[]) => {
    const map = Object.fromEntries(Object.entries(meta || {}).map(([k, v]) => [norm(String(k)), v]));
    for (const k of keys) {
      const v = map[norm(k)];
      if (v != null && String(v).length > 0) return String(v);
    }
    return "";
  };
  const META_KEYS_DOB = ["dob","date_of_birth","geburtsdatum","geburtstag","birth_date","billing_dob","billing_birthdate","_billing_birthdate","birthday"];
  const META_KEYS_BIRTH_PLACE = ["geburtsort","ort der geburt","geburts stadt","birthplace","place_of_birth","birth_place"];
  const META_KEYS_NATIONALITY = ["nationality","billing_nationality","staatsangehoerigkeit","staatsangehörigkeit","nationalitaet","nationalität","geburtsland","birth_country","country_of_birth","geburts land"];
  const META_KEYS_EXAM_KIND = ["pruefungstyp","prüfungstyp","exam_type","exam_kind","type","typ","teilnahmeart","pruefung_art","prüfungsart","pruefungsart","art_der_pruefung","prüfung_typ","exam_variant","variant","variante","language_level","exam_level","niveau"];
  const META_KEYS_CERT = ["zertifikat","certificate","certificate_delivery","zertifikat_versand","zertifikat versand","lieferung_zertifikat","zertifikat_abholung"];

  const buildRowFromResult = (res: any): { row: string[]; pDate: string } => {
    const wo = res?.wooOrder || {};
    const pd = res?.participantData || {};
    const customerName: string = (wo as any).customerName || "";
    const nameParts = customerName.trim().split(/\s+/);
    const derivedLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const derivedFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || "";

    const w: any = wo;
    const surname = w.billingLastName || pd.nachname || derivedLast;
    const firstName = w.billingFirstName || pd.vorname || derivedFirst;

    const meta = ((wo as any).meta || {}) as Record<string, any>;
    const birthdayRaw = pd.geburtsdatum || pd.birthday || w.extracted?.dob || getFromMeta(meta, META_KEYS_DOB);
    const birthday = normalizeBirthday(birthdayRaw);
    const birthPlace = getFromMeta(meta, META_KEYS_BIRTH_PLACE) || (w.extracted?.birthPlace || "");
    const nationality = pd.geburtsland || pd.birthland || pd.geburtsland_de || getFromMeta(meta, META_KEYS_NATIONALITY) || (w.extracted?.nationality || "");

    const examKindResolved = getFromMeta(meta, META_KEYS_EXAM_KIND) || w.extracted?.examKind || w.extracted?.level || "";
    const metaVals = Object.values(meta).map((v) => String(v).toLowerCase());
    const examPart = (pd.pruefungsteil || pd.examPart || metaVals.find((v) => v.includes("nur mündlich") || v.includes("nur muendlich") || v.includes("nur schriftlich")) || "");

    const certMeta = getFromMeta(meta, META_KEYS_CERT) || (w.extracted?.certificate || "");
    const certificate = certMeta
      ? /post/i.test(certMeta) ? "Per Post" : /abhol/i.test(certMeta) ? "Abholen im Büro" : String(certMeta)
      : "";

    const examDateRaw = w.extracted?.examDate || "";
    const pDatum = normalizeBirthday(examDateRaw);
    const bDatum = toDDMMYYYY(w?.bookingDate || w?.date_created || "");

    const bn = String(w.number || w.id || "");
    const email = w.email || "";
    const tel = w.phone || "";
    const zahlung = w.paymentMethod || "";
    const preis = "";
    const status = "Offen";
    const mitarbeiter = "Fayez";

    return { row: [bn, surname, firstName, birthday, birthPlace, nationality, email, tel, examKindResolved, examPart, certificate, pDatum, bDatum, zahlung, preis, status, mitarbeiter], pDate: pDatum };
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
      const details: any[] = [];
      for (const r of selectedRows) {
        const res = await fetch(`${apiBase}/orders/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchCriteria: { orderNumber: String(r.id) } }),
        });
        if (!res.ok) throw new Error(`Search failed ${res.status}`);
        const j = await res.json();
        const arr: any[] = Array.isArray(j?.results) ? j.results : [];
        const match = arr.find((it) => Number(it?.wooOrder?.id) === Number(r.id)) || arr[0];
        if (match) details.push(match);
      }

      // Group by target monthly sheet title key MM.YYYY, using mapped P.Datum
      const byMonth: Record<string, { row: string[]; pDate: string }[]> = {};
      for (const d of details) {
        const mapped = buildRowFromResult(d);
        const key = monthKeyFromDate(mapped.pDate || "");
        if (!key) continue;
        (byMonth[key] ||= []).push(mapped);
      }

      const monthKeys = Object.keys(byMonth);
      if (monthKeys.length === 0) throw new Error("No exam dates found in selection");

      for (const key of monthKeys) {
        const title = findMonthlySheetTitle(tabs, key);
        if (!title) throw new Error(`Sheet for ${key} not found`);
        // Sort by exam date ascending
        const group = byMonth[key].slice().sort((a, b) => {
          const A = (a.pDate || "").split("."); // DD.MM.YYYY
          const B = (b.pDate || "").split(".");
          const ak = A.length === 3 ? `${A[2]}-${A[1]}-${A[0]}` : a.pDate;
          const bk = B.length === 3 ? `${B[2]}-${B[1]}-${B[0]}` : b.pDate;
          return String(ak).localeCompare(String(bk));
        });
        for (let i = 0; i < group.length; i++) {
          await appendRow(title, group[i].row);
        }
        // After the group, insert two empty rows and repeat header for next time
        await appendRow(title, [""]);
        await appendRow(title, [""]);
        await appendRow(title, HEADER);
      }

      toast({ title: "Added", description: `Appended ${details.length} rows` });
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
