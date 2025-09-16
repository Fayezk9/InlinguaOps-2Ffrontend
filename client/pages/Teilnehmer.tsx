import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useI18n } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatDateDDMMYYYY } from "@/lib/utils";

type Section = "none" | "anmelde" | "teilnahme" | "address";

const parseOrderNumbers = (text: string): string[] => {
  const ids = Array.from(text.matchAll(/[0-9]{2,}/g)).map((m) => m[0]);
  return Array.from(new Set(ids));
};

export default function Teilnehmer() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState<Section>("none");
  const [input, setInput] = useState("");
  const ids = useMemo(() => parseOrderNumbers(input), [input]);
  const [loading, setLoading] = useState(false);
  const [pdfTemplateOk, setPdfTemplateOk] = useState<boolean | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [orderInfo, setOrderInfo] = useState<any | null>(null);
  const [editedInfo, setEditedInfo] = useState<any | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [chooseExamOpen, setChooseExamOpen] = useState(false);
  const [selectedExams, setSelectedExams] = useState<{ id: number; kind: string; date: string }[]>([]);
  const [exams, setExams] = useState<
    { id: number; kind: string; date: string }[]
  >([]);
  const [upcomingOnlyEx, setUpcomingOnlyEx] = useState(true);
  const [groupByKindEx, setGroupByKindEx] = useState(true);
  const [perPostOrders, setPerPostOrders] = useState<any[]>([]);
  const [perPostPage, setPerPostPage] = useState(1);
  const [perPostLoading, setPerPostLoading] = useState(false);
  const [perPostOlderIds, setPerPostOlderIds] = useState<number[]>([]);
  const [olderLoading, setOlderLoading] = useState(false);
  const [wooBase, setWooBase] = useState<string | null>(null);
  const [perPostSearched, setPerPostSearched] = useState(false);
  const [schoolAddress, setSchoolAddress] = useState<any | null>(null);
  const [addrCsvUrl, setAddrCsvUrl] = useState<string | null>(null);
  const [addrMaking, setAddrMaking] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"order" | "last">("order");
  const [addOrderText, setAddOrderText] = useState("");
  const [addOrderLoading, setAddOrderLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickOptions, setPickOptions] = useState<any[]>([]);
  const perPostAbortRef = useRef<AbortController | null>(null);
  const olderAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const stp = await fetchFallback(
          "/api/docs/registration-pdf-template/status",
        );
        const sjp = await stp.json().catch(() => ({}));
        if (stp.ok && sjp?.exists) {
          const vrp = await fetchFallback(
            "/api/docs/registration-pdf-template/validate",
          );
          const vjp = await vrp.json().catch(() => ({}));
          if (vrp.ok) setPdfTemplateOk(!!vjp?.ok);
        }
      } catch (e) {
        console.debug("registration template status check failed", e);
      }
    })();
  }, []);

  // Abort ongoing searches when window closes or page unmounts
  useEffect(() => {
    if (!showAddress) {
      try {
        perPostAbortRef.current?.abort();
      } catch {}
      try {
        olderAbortRef.current?.abort();
      } catch {}
    }
  }, [showAddress]);
  useEffect(() => {
    return () => {
      try {
        perPostAbortRef.current?.abort();
      } catch {}
      try {
        olderAbortRef.current?.abort();
      } catch {}
    };
  }, []);

  // Fetch school address (and logo) when showing address section
  useEffect(() => {
    if (!showAddress) return;
    (async () => {
      try {
        const r = await fetchFallback("/api/school/address");
        const j = await r.json().catch(() => ({}));
        setSchoolAddress(j?.address || null);
      } catch {}
      try {
        const lr = await fetchFallback("/api/school/logo");
        const lj = await lr.json().catch(() => ({}));
        setSchoolLogo(lj?.logo || null);
      } catch {}
    })();
  }, [showAddress]);

  const normalizeDate = (s: string): string => {
    const str = String(s || "").trim();
    const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`;
    const m2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2)
      return `${m2[3].padStart(2, "0")}.${m2[2].padStart(2, "0")}.${m2[1]}`;
    const t = Date.parse(str);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return `${dd}.${mm}.${yyyy}`;
    }
    return str;
  };

  // Robust fetch helper that tries multiple candidate base paths (useful when the API is proxied)
  async function fetchFallback(
    input: RequestInfo | string,
    init?: RequestInit,
  ) {
    const path =
      typeof input === "string" ? input : ((input as any).url ?? String(input));
    const candidates: string[] = [];
    if (path.startsWith("/")) {
      // prefer absolute origin first (works when app is proxied)
      try {
        candidates.push(window.location.origin + path);
      } catch {}
      candidates.push(path);
      candidates.push("/.netlify/functions" + path);
      try {
        candidates.push(window.location.origin + "/.netlify/functions" + path);
      } catch {}
    } else {
      candidates.push(path);
    }

    let lastErr: any = new Error("No candidates");
    for (const c of candidates) {
      try {
        const res = await fetch(c, init as any);
        return res;
      } catch (e: any) {
        // store but continue trying other candidates
        lastErr = e;
      }
    }
    // throw a helpful error mentioning tried candidates
    const err = new Error(
      `Failed to fetch ${path} (tried: ${candidates.join(", ")}) - last error: ${
        lastErr?.message || String(lastErr)
      }`,
    );
    (err as any).cause = lastErr;
    throw err;
  }

  async function callApi(path: string) {
    if (ids.length === 0) {
      toast({
        title: "No order numbers",
        description: "Enter one or more order numbers first.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
                        try { (document.activeElement as any)?.blur?.(); } catch {}
                        setEditingKey(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumbers: ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          j?.error || j?.message || `Request failed (${res.status})`,
        );
      toast({
        title: "Done",
        description: j?.message || "Operation completed",
      });
      try {
        import("@/lib/history").then(({ logHistory }) => {
          const user = localStorage.getItem("currentUserName") || "User";
          logHistory({
            type: "participants_action",
            message: `${user} ran ${path} for ${ids.length} orders`,
          });
        });
      } catch {}
    } catch (e: any) {
      toast({
        title: "Failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>
            {t("manageParticipants", "Manage Participants")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="w-full max-w-xs mx-auto space-y-2">
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  setOpen((v) => (v === "anmelde" ? "none" : "anmelde"))
                }
              >
                {t("registrationConfirmation", "Registration Confirmation")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  setOpen((v) => (v === "teilnahme" ? "none" : "teilnahme"))
                }
              >
                {t("participationConfirmation", "Participation Confirmation")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => {
                  setOpen("none");
                  setShowAddress((v) => !v);
                }}
              >
                {t("addressPostList", "Address Post List")}
              </Button>
            </li>
          </ul>

          {open !== "none" && (
            <div className="mt-4 rounded-md border border-border p-3">
              {open === "anmelde" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <Textarea
                    placeholder={
                      t("orderNumber", "Order Number") +
                      "��� (one per line or mixed text)"
                    }
                    className="min-h-[220px] flex-1"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex md:flex-col gap-2 md:w-60">
                    <div className="text-xs text-muted-foreground md:order-last">
                      Parsed: {ids.length}
                    </div>
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={async () => {
                        if (ids.length === 0) {
                          toast({
                            title: "No order numbers",
                            description:
                              "Enter one or more order numbers first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setLoading(true);
                        try { (document.activeElement as any)?.blur?.(); } catch {}
                        setEditingKey(null);
                        try {
                          const res = await fetchFallback(
                            "/api/docs/registration-data",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderNumbers: ids }),
                            },
                          );
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok)
                            throw new Error(
                              j?.message || `Request failed (${res.status})`,
                            );
                          const data = j?.data || null;
                          setOrderInfo(data);
                          setEditedInfo(data ? { ...data } : null);
                          setShowInfo(true);
                        } catch (e: any) {
                          toast({
                            title: "Failed",
                            description: e?.message ?? "Unknown error",
                            variant: "destructive",
                          });
                        }
                        setLoading(false);
                      }}
                    >
                      Show Info
                    </Button>
                    {pdfTemplateOk !== null && (
                      <div
                        className={
                          "text-xs font-medium " +
                          (pdfTemplateOk ? "text-green-600" : "text-red-600")
                        }
                      >
                        {pdfTemplateOk
                          ? "PDF template OK"
                          : "PDF template needs fixes"}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className={
                        pdfTemplateOk && editedInfo
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : undefined
                      }
                      disabled={loading || !editedInfo}
                      onClick={async () => {
                        if (ids.length === 0) {
                          toast({
                            title: "No order numbers",
                            description:
                              "Enter one or more order numbers first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!editedInfo) {
                          toast({
                            title: "Info required",
                            description: "Click Show Info first to load data.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setLoading(true);
                        try { (document.activeElement as any)?.blur?.(); } catch {}
                        setEditingKey(null);
                        try {
                          const res = await fetchFallback(
                            "/api/docs/generate-registration-pdf",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                orderNumbers: ids,
                                overrides: { ...(editedInfo as any) },
                                templateType: "registration",
                              }),
                            },
                          );
                          if (!res.ok) {
                            const j = await res.json().catch(() => ({}));
                            throw new Error(
                              j?.message || `Request failed (${res.status})`,
                            );
                          }
                          const blob = await res.blob();
                          const a = document.createElement("a");
                          const url = URL.createObjectURL(blob);
                          a.href = url;
                          a.download = `registration-${ids[0]}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast({
                            title: "Done",
                            description: `PDF generated for ${ids[0]}`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Failed",
                            description: e?.message ?? "Unknown error",
                            variant: "destructive",
                          });
                        }
                        setLoading(false);
                      }}
                    >
                      {t(
                        "makeRegistrationConfirmation",
                        "Make Registration Confirmation",
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {open === "teilnahme" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <Textarea
                    placeholder={
                      t("orderNumber", "Order Number") +
                      "… (one per line or mixed text)"
                    }
                    className="min-h-[220px] flex-1"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex md:flex-col gap-2 md:w-60">
                    <div className="text-xs text-muted-foreground md:order-last">
                      Parsed: {ids.length}
                    </div>
                    <Button
                      disabled={loading}
                      onClick={() =>
                        callApi("/api/java-actions/make-participation-pdf")
                      }
                    >
                      {t(
                        "makeParticipationConfirmation",
                        "Make Participation Confirmation",
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      disabled={loading || !editedInfo}
                      onClick={async () => {
                        if (ids.length === 0) {
                          toast({
                            title: "No order numbers",
                            description:
                              "Enter one or more order numbers first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!editedInfo) {
                          toast({
                            title: "Info required",
                            description: "Click Show Info first to load data.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setLoading(true);
                        try { (document.activeElement as any)?.blur?.(); } catch {}
                        setEditingKey(null);
                        try {
                          const res = await fetchFallback(
                            "/api/docs/generate-registration-pdf",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                orderNumbers: ids,
                                overrides: { ...(editedInfo as any) },
                                templateType: "participation",
                              }),
                            },
                          );
                          if (!res.ok) {
                            const j = await res.json().catch(() => ({}));
                            throw new Error(
                              j?.message || `Request failed (${res.status})`,
                            );
                          }
                          const blob = await res.blob();
                          const a = document.createElement("a");
                          const url = URL.createObjectURL(blob);
                          a.href = url;
                          a.download = `participation-${ids[0]}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast({
                            title: "Done",
                            description: `Participation PDF generated for ${ids[0]}`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Failed",
                            description: e?.message ?? "Unknown error",
                            variant: "destructive",
                          });
                        }
                        setLoading(false);
                      }}
                    >
                      Generate Participation PDF (template)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddress && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="border border-border rounded-md p-4 text-sm bg-card">
            <div className="flex flex-col md:flex-row gap-3 items-stretch">
              <div className="flex-1 space-y-2">
                <div className="text-xs text-muted-foreground">Options</div>
                <Button
                  variant={selectedExams.length > 0 ? "default" : "outline"}
                  className={
                    selectedExams.length > 0
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : undefined
                  }
                  onClick={async () => {
                    try {
                      if (exams.length === 0) {
                        const r = await fetchFallback("/api/exams");
                        const j = await r.json().catch(() => ({}));
                        setExams(Array.isArray(j?.exams) ? j.exams : []);
                      }
                      if (!wooBase) {
                        try {
                          const r2 = await fetchFallback(
                            "/api/woocommerce/config",
                          );
                          const j2 = await r2.json().catch(() => ({}));
                          if (r2.ok && j2?.config?.baseUrl)
                            setWooBase(String(j2.config.baseUrl));
                        } catch {}
                      }
                    } catch {}
                    setChooseExamOpen(true);
                  }}
>
                  {selectedExams.length === 0
                    ? "Choose Exams"
                    : selectedExams.length === 1
                      ? `${selectedExams[0].kind} – ${formatDateDDMMYYYY(selectedExams[0].date)}`
                      : `${selectedExams.length} exams selected`}
                </Button>
              </div>
              <div className="flex md:flex-col gap-2 md:w-60">
                <Button
                  variant="default"
                  className={undefined}
                  disabled={
                    loading || addrMaking || (!addrCsvUrl && perPostOrders.length === 0)
                  }
                  onClick={async () => {
                    if (addrCsvUrl) {
                      try {
                        const a = document.createElement("a");
                        a.href = addrCsvUrl;
                        const name = selectedExams.length === 1
                          ? `address-post-list_${selectedExams[0].kind.replace(/[^A-Za-z0-9_-]+/g, "_")}_${formatDateDDMMYYYY(selectedExams[0].date).replace(/[^0-9.]+/g, "")}.xlsx`
                          : "address-post-list_multi.xlsx";
                        a.download = name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      } catch {}
                      return;
                    }
                    setAddrMaking(true);
                    try {
                      const isDE = lang === "de";
                      const headers = isDE
                        ? [
                            "Nachname",
                            "Vorname",
                            "Straße",
                            "Hausnummer",
                            "PLZ",
                            "Stadt",
                          ]
                        : [
                            "Last Name",
                            "First Name",
                            "Street",
                            "House Number",
                            "ZIP",
                            "City",
                          ];
                      let school = schoolAddress;
                      try {
                        if (!school) {
                          const sr = await fetchFallback("/api/school/address");
                          const sj = await sr.json().catch(() => ({}));
                          school = sj?.address || null;
                          if (school) setSchoolAddress(school);
                        }
                      } catch {}

                      const rows = perPostOrders.map((r: any) => [
                        String(r.lastName || "").trim(),
                        String(r.firstName || "").trim(),
                        String(r.street || "").trim(),
                        String(r.houseNo || "").trim(),
                        String(r.zip || "").trim(),
                        String(r.city || "").trim(),
                      ]);

                      const schoolRow = [
                        String(school?.lastName || "").trim(),
                        String(school?.firstName || "").trim(),
                        String(school?.street || "").trim(),
                        String(school?.houseNumber || "").trim(),
                        String(school?.zip || "").trim(),
                        String(school?.city || "").trim(),
                      ];

                      const repeatedSchool = Array.from(
                        { length: perPostOrders.length },
                        () => [...schoolRow],
                      );

                      const logoDataUrl = schoolLogo || null;

                      // Build with ExcelJS to embed logo images
                      const wb2 = new ExcelJS.Workbook();
                      const ws2 = wb2.addWorksheet("Addresses");

                      const headersWithLogo = [...headers, "Logo"];
                      ws2.addRow(headersWithLogo);
                      // Column widths
                      const widths = [20, 18, 28, 14, 10, 20, 10];
                      (ws2 as any).columns = widths.map((w) => ({ width: w }));

                      // Participant rows (no logo)
                      for (const r of rows) ws2.addRow([...r, ""]);

                      // School rows with logo
                      const startRowForSchool = 2 + rows.length; // 1 header + rows
                      const logoColIndex = headersWithLogo.length; // last column

                      let imageId: number | null = null;
                      if (logoDataUrl) {
                        try {
                          const base64 = logoDataUrl.split(",")[1] || "";
                          const ext = /data:image\/(png|jpe?g)/i.exec(logoDataUrl)?.[1] || "png";
                          imageId = wb2.addImage({ base64, extension: ext.toLowerCase() as any });
                        } catch {}
                      }

                      for (let i = 0; i < repeatedSchool.length; i++) {
                        ws2.addRow([...repeatedSchool[i], ""]);
                        if (imageId != null) {
                          const rowNumber = startRowForSchool + i;
                          const colZeroBased = logoColIndex - 1;
                          // set row height to fit ~32px
                          ws2.getRow(rowNumber).height = 28;
                          ws2.addImage(imageId, {
                            tl: { col: colZeroBased, row: rowNumber - 1 },
                            ext: { width: 64, height: 24 },
                          });
                        }
                      }

                      const out2 = await wb2.xlsx.writeBuffer();
                      const blob = new Blob([out2], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      });
                      const url = URL.createObjectURL(blob);
                      setAddrCsvUrl(url);
                      toast({
                        title: isDE ? "Liste bereit" : "List ready",
                        description: logoDataUrl
                          ? isDE
                            ? "Logo in der Excel-Liste eingebettet."
                            : "Logo embedded into Excel list."
                          : isDE
                            ? 'Klicken Sie auf "Excel-Liste herunterladen".'
                            : "Click Download Excel List to save the file.",
                      });
                    } catch (e: any) {
                      toast({
                        title: "Failed",
                        description: e?.message ?? "Could not build list",
                        variant: "destructive",
                      });
                    }
                    setAddrMaking(false);
                  }}
                >
                  {addrCsvUrl
                    ? "Download Excel List"
                    : t("makeAddressPostList", "Make Address Post List")}
                </Button>

                <div className="flex">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    {lang === "de" ? "Bestellung hinzufügen" : "Add Order"}
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  className={
                    perPostLoading ? "btn-glow-fade btn-loading" : undefined
                  }
                  disabled={loading || perPostLoading}
                  onClick={async () => {
                    if (selectedExams.length === 0) {
                      toast({
                        title: "Exam required",
                        description: "Choose at least one exam first.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setPerPostLoading(true);
                    setPerPostOrders([]);
                    setPerPostPage(1);
                    setPerPostSearched(false);
                    if (addrCsvUrl) {
                      try {
                        URL.revokeObjectURL(addrCsvUrl);
                      } catch {}
                      setAddrCsvUrl(null);
                    }
                    try {
                      try {
                        perPostAbortRef.current?.abort();
                      } catch {}
                      perPostAbortRef.current = new AbortController();
                      const signal = perPostAbortRef.current.signal;
                      if (signal.aborted) throw new Error("aborted");
                      const ir = await fetchFallback(
                        "/api/orders/by-exam/ids",
                        { signal },
                      );
                      const ij = await ir.json().catch(() => ({}));
                      if (!ir.ok)
                        throw new Error(
                          ij?.message || `Failed to list orders (${ir.status})`,
                        );
                      const allIds: number[] = Array.isArray(ij?.ids)
                        ? ij.ids
                            .map((x: any) => Number(x))
                            .filter(Number.isFinite)
                        : [];
                      const sorted = allIds.slice().sort((a, b) => b - a);
                      const cutoff = 5100;
                      const cutoffIdx = sorted.findIndex(
                        (x) => Number(x) < cutoff,
                      );
                      const firstBatch =
                        cutoffIdx >= 0
                          ? sorted.slice(0, cutoffIdx)
                          : sorted.slice();
                      const older =
                        cutoffIdx >= 0 ? sorted.slice(cutoffIdx) : [];
                      setPerPostOlderIds(older);

                      const list = firstBatch;
                      const limit = 6;
                      const seen = new Set<string>();

                      for (const ex of selectedExams) {
                        let index = 0;
                        let sinceNoMatch = 0;
                        let foundAny = false;
                        let stop = false;
                        const run = async () => {
                          while (true) {
                            if (stop) break;
                            const current = index++;
                            if (current >= list.length) break;
                            const id = list[current];
                            try {
                              if (signal.aborted) {
                                stop = true;
                                break;
                              }
                              const cr = await fetchFallback(
                                "/api/orders/by-exam/check",
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id, kind: ex.kind, date: ex.date }),
                                  signal,
                                } as any,
                              );
                              const cj = await cr.json().catch(() => ({}));
                              if (signal.aborted) {
                                stop = true;
                                break;
                              }
                              if (cr.ok && cj?.match && cj?.row) {
                                const key = String(cj.row.orderNumber);
                                if (!seen.has(key)) {
                                  seen.add(key);
                                  setPerPostOrders((prev) => [...prev, cj.row]);
                                }
                                foundAny = true;
                                sinceNoMatch = 0;
                              } else {
                                if (foundAny) sinceNoMatch++;
                                if (foundAny && sinceNoMatch >= 150) {
                                  stop = true;
                                  break;
                                }
                              }
                            } catch (e) {
                              if (signal.aborted) {
                                stop = true;
                                break;
                              }
                              if (foundAny) sinceNoMatch++;
                              if (foundAny && sinceNoMatch >= 150) {
                                stop = true;
                                break;
                              }
                            }
                          }
                        };
                        await Promise.all(
                          Array.from(
                            { length: Math.min(limit, list.length) },
                            () => run(),
                          ),
                        );
                      }
                      setPerPostSearched(true);
                    } catch (e: any) {
                      toast({
                        title: "Failed",
                        description: e?.message ?? "Unknown error",
                        variant: "destructive",
                      });
                    }
                    perPostAbortRef.current = null;
                    setPerPostLoading(false);
                  }}
                >
                  Per Post Orders
                </Button>
              </div>
            </div>

            {(perPostLoading || perPostOrders.length > 0) && (
              <div className="mt-4">
                {perPostOrders.length > 0 ? (
                  <>
                    <div className="overflow-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b">
                            <th className="text-left px-2 py-1 w-20 whitespace-nowrap">
                              {lang === "de" ? "B.Nr" : "Or.Nr"}
                            </th>
                            <th className="text-left px-2 py-1 w-32">
                              {t("lastName", "Last Name")}
                            </th>
                            <th className="text-left px-2 py-1 w-32">
                              {t("firstName", "First Name")}
                            </th>
                            <th className="text-left px-2 py-1 w-16 whitespace-nowrap">
                              {t("exam", "Exam")}
                            </th>
                            <th className="text-left px-2 py-1">Street</th>
                            <th className="text-left px-2 py-1 w-24 whitespace-nowrap">
                              HouseNr.
                            </th>
                            <th className="text-left px-2 py-1 w-20 whitespace-nowrap">
                              ZIP
                            </th>
                            <th className="text-left px-2 py-1">City</th>
                            <th className="text-left px-2 py-1 w-20 whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perPostOrders
                            .slice((perPostPage - 1) * 10, perPostPage * 10)
                            .map((row: any, idx: number) => {
                              const start = (perPostPage - 1) * 10;
                              const absIdx = start + idx;
                              return (
                                <tr
                                  key={`${row.orderNumber}-${idx}`}
                                  className="border-b last:border-b-0 align-top"
                                >
                                  <td className="px-2 py-1 font-mono w-20 whitespace-nowrap">
                                    {wooBase && row.orderId ? (
                                      <a
                                        className="underline text-primary hover:opacity-80"
                                        href={(() => {
                                          try {
                                            return new URL(
                                              `/wp-admin/post.php?post=${encodeURIComponent(row.orderId)}&action=edit`,
                                              wooBase!,
                                            ).toString();
                                          } catch {
                                            return "#";
                                          }
                                        })()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Open in WooCommerce"
                                      >
                                        {row.orderNumber}
                                      </a>
                                    ) : (
                                      <span>{row.orderNumber}</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 w-32 whitespace-normal break-words leading-tight">
                                    {row.lastName}
                                  </td>
                                  <td className="px-2 py-1 w-32 whitespace-normal break-words leading-tight">
                                    {row.firstName}
                                  </td>
                                  <td
                                    className="px-2 py-1 w-16 whitespace-nowrap"
                                    title={row.examType}
                                  >
                                    {row.examType}
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      className="w-full bg-transparent border border-border rounded px-1 py-0.5"
                                      value={row.street || ""}
                                      onChange={(e) =>
                                        setPerPostOrders((prev) =>
                                          prev.map((r: any, i: number) =>
                                            i === absIdx
                                              ? { ...r, street: e.target.value }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1 w-24">
                                    <input
                                      className="w-full bg-transparent border border-border rounded px-1 py-0.5"
                                      value={row.houseNo || ""}
                                      onChange={(e) =>
                                        setPerPostOrders((prev) =>
                                          prev.map((r: any, i: number) =>
                                            i === absIdx
                                              ? {
                                                  ...r,
                                                  houseNo: e.target.value,
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1 w-20">
                                    <input
                                      className="w-full bg-transparent border border-border rounded px-1 py-0.5"
                                      value={row.zip || ""}
                                      onChange={(e) =>
                                        setPerPostOrders((prev) =>
                                          prev.map((r: any, i: number) =>
                                            i === absIdx
                                              ? { ...r, zip: e.target.value }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      className="w-full bg-transparent border border-border rounded px-1 py-0.5"
                                      value={row.city || ""}
                                      onChange={(e) =>
                                        setPerPostOrders((prev) =>
                                          prev.map((r: any, i: number) =>
                                            i === absIdx
                                              ? { ...r, city: e.target.value }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1 w-20">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (addrCsvUrl) {
                                          try { URL.revokeObjectURL(addrCsvUrl); } catch {}
                                          setAddrCsvUrl(null);
                                        }
                                        setPerPostOrders((prev) => prev.filter((_, i) => i !== absIdx));
                                        toast({ title: lang === "de" ? "Entfernt" : "Removed", description: `#${row.orderNumber}` });
                                      }}
                                      title={lang === "de" ? "Entfernen" : "Remove"}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">
                        Page {perPostPage} /{" "}
                        {Math.max(1, Math.ceil(perPostOrders.length / 10))} •
                        Total {perPostOrders.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={perPostPage <= 1}
                          onClick={() =>
                            setPerPostPage((p) => Math.max(1, p - 1))
                          }
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            perPostPage >= Math.ceil(perPostOrders.length / 10)
                          }
                          onClick={() =>
                            setPerPostPage((p) =>
                              Math.min(
                                Math.ceil(perPostOrders.length / 10),
                                p + 1,
                              ),
                            )
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                    {!perPostLoading && perPostOlderIds.length > 0 && (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          disabled={olderLoading}
                          onClick={async () => {
                            setOlderLoading(true);
                            if (addrCsvUrl) {
                              try {
                                URL.revokeObjectURL(addrCsvUrl);
                              } catch {}
                              setAddrCsvUrl(null);
                            }
                            try {
                              try {
                                olderAbortRef.current?.abort();
                              } catch {}
                              olderAbortRef.current = new AbortController();
                              const signal = olderAbortRef.current.signal;
                              const list = perPostOlderIds.slice();
                              const limit = 6;
                              let index = 0;
                              let sinceNoMatch = 0;
                      let foundAny = false;
                              let stop = false;
                              const runForExam = async (ex: {kind: string; date: string}) => {
                                while (true) {
                                  if (stop) break;
                                  const current = index++;
                                  if (current >= list.length) break;
                                  const id = list[current];
                                  try {
                                    if (signal.aborted) {
                                      stop = true;
                                      break;
                                    }
                                    const cr = await fetchFallback(
                                      "/api/orders/by-exam/check",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({ id, kind: ex.kind, date: ex.date }),
                                        signal,
                                      } as any,
                                    );
                                    const cj = await cr
                                      .json()
                                      .catch(() => ({}));
                                    if (signal.aborted) {
                                      stop = true;
                                      break;
                                    }
                                    if (cr.ok && cj?.match && cj?.row) {
                                      setPerPostOrders((prev) => [
                                        ...prev,
                                        cj.row,
                                      ]);
                                      foundAny = true;
                              sinceNoMatch = 0;
                                    } else {
                                      if (foundAny) sinceNoMatch++;
                                      if (foundAny && sinceNoMatch >= 150) {
                                        stop = true;
                                        break;
                                      }
                                    }
                                  } catch {
                                    if (signal.aborted) {
                                      stop = true;
                                      break;
                                    }
                                    if (foundAny) sinceNoMatch++;
                                    if (foundAny && sinceNoMatch >= 150) {
                                      stop = true;
                                      break;
                                    }
                                  }
                                }
                              };
                              for (const ex of selectedExams) {
                                index = 0; sinceNoMatch = 0; foundAny = false; stop = false;
                                await Promise.all(
                                  Array.from(
                                    { length: Math.min(limit, list.length) },
                                    () => runForExam(ex),
                                  ),
                                );
                              }
                              setPerPostOlderIds([]);
                            } catch {}
                            olderAbortRef.current = null;
                            setOlderLoading(false);
                          }}
                        >
                          {olderLoading ? "Loading older…" : "Older"}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="border rounded-md p-3 text-sm text-muted-foreground">
                    {perPostLoading
                      ? `Searching Per Post orders… Found ${perPostOrders.length}`
                      : "No matching orders found"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={chooseExamOpen} onOpenChange={setChooseExamOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Choose Exams</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="addr-toggle-upcoming"
                checked={upcomingOnlyEx}
                onCheckedChange={setUpcomingOnlyEx}
              />
              <label htmlFor="addr-toggle-upcoming" className="text-sm">
                {upcomingOnlyEx ? "Show Upcoming" : "Show All"}
              </label>
              <Button
                size="sm"
                variant={groupByKindEx ? "default" : "outline"}
                onClick={() => setGroupByKindEx((v) => !v)}
              >
                By Exam
              </Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-md border">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const list = (
                  upcomingOnlyEx
                    ? exams.filter((ex) => {
                        const d = new Date(ex.date);
                        d.setHours(0, 0, 0, 0);
                        return d.getTime() >= today.getTime();
                      })
                    : exams.slice()
                ).sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime(),
                );
                if (groupByKindEx) {
                  const map = new Map<
                    string,
                    { id: number; kind: string; date: string }[]
                  >();
                  for (const ex of list) {
                    const arr = map.get(ex.kind) || [];
                    arr.push(ex);
                    map.set(ex.kind, arr);
                  }
                  const entries = Array.from(map.entries()).sort((a, b) =>
                    a[0].localeCompare(b[0]),
                  );
                  return (
                    <div>
                      {entries.map(([kind, arr]) => (
                        <div key={kind}>
                          <div className="bg-muted/30 px-2 py-1 font-semibold border-b">
                            {kind}
                          </div>
                          <div className="p-2">
                            {arr.map((ex) => {
                              const checked = selectedExams.some((s) => s.id === ex.id);
                              return (
                                <label
                                  key={ex.id}
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      setSelectedExams((prev) =>
                                        v ? [...prev, ex] : prev.filter((p) => p.id !== ex.id),
                                      );
                                    }}
                                  />
                                  {formatDateDDMMYYYY(ex.date)}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div>
                    {list.map((ex) => {
                      const checked = selectedExams.some((s) => s.id === ex.id);
                      return (
                        <label
                          key={ex.id}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-accent border-b last:border-b-0 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedExams((prev) =>
                                v ? [...prev, ex] : prev.filter((p) => p.id !== ex.id),
                              );
                            }}
                          />
                          <span className="inline-block w-10 font-mono">
                            {ex.kind}
                          </span>
                          {formatDateDDMMYYYY(ex.date)}
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{lang === "de" ? "Zur Liste hinzufügen" : "Add to list"}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddMode((m) => (m === "order" ? "last" : "order"))}
            >
              {addMode === "order" ? (lang === "de" ? "Bestellnr." : "Order #") : (lang === "de" ? "Nachname" : "Last name")}
            </Button>
            <Input
              autoFocus
              placeholder={
                addMode === "order"
                  ? lang === "de"
                    ? "Bestellnr. hinzufügen"
                    : "Add order number(s)"
                  : lang === "de"
                    ? "Nachname eingeben"
                    : "Enter last name"
              }
              value={addOrderText}
              onChange={(e) => setAddOrderText(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)}>
              {lang === "de" ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              disabled={addOrderLoading || !addOrderText.trim()}
              onClick={async () => {
                setAddOrderLoading(true);
                try {
                  const toRow = (o: any) => {
                    const w = o?.wooOrder || {};
                    const ex = w?.extracted || {};
                    const billingAddress1 = w?.billingAddress1 || "";
                    const billingAddress2 = w?.billingAddress2 || "";
                    const shippingAddress1 = w?.shippingAddress1 || "";
                    const shippingAddress2 = w?.shippingAddress2 || "";
                    const billingCity = w?.billingCity || "";
                    const shippingCity = w?.shippingCity || "";
                    const billingPostcode = w?.billingPostcode || "";
                    const shippingPostcode = w?.shippingPostcode || "";
                    const streetRaw = String(billingAddress1 || shippingAddress1 || "");
                    const line2 = String(billingAddress2 || shippingAddress2 || "");
                    const streetJoin = [streetRaw, line2].filter(Boolean).join(" ").trim();
                    const extractHouseNo = (s: string) => {
                      const matches = Array.from(String(s).matchAll(/\b(\d+[a-zA-Z]?)\b/g));
                      return matches.length ? matches[matches.length - 1][1] : "";
                    };
                    const hn = String(ex?.houseNo || extractHouseNo(streetJoin));
                    const street = hn
                      ? streetJoin
                          .replace(new RegExp(`\\b${hn}\\b`), "")
                          .replace(/\s{2,}/g, " ")
                          .trim()
                      : streetJoin;
                    const city = String(billingCity || shippingCity || "");
                    const zip = String(billingPostcode || shippingPostcode || "");
                    const examType = String(ex?.level || ex?.examKind || "");
                    const examDate = normalizeDate(ex?.examDate || "");
                    const cert = String(ex?.certificate || "");
                    return {
                      orderId: Number(w?.id || 0),
                      orderNumber: String(w?.number || w?.id || ""),
                      lastName: String(w?.billingLastName || ""),
                      firstName: String(w?.billingFirstName || ""),
                      examType,
                      examDate,
                      certificate: cert,
                      street,
                      houseNo: hn,
                      zip,
                      city,
                    };
                  };

                  if (addMode === "order") {
                    const nums = Array.from(addOrderText.matchAll(/[0-9]{2,}/g))
                      .map((m) => m[0])
                      .filter((s) => s.trim().length > 0);
                    if (nums.length === 0) {
                      toast({ title: lang === "de" ? "Keine Nummern" : "No numbers" });
                    } else {
                      const rows: any[] = [];
                      for (const id of nums) {
                        try {
                          const sr = await fetchFallback("/api/orders/search", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ searchCriteria: { orderNumber: String(id) } }),
                          } as any);
                          const sj = await sr.json().catch(() => ({}));
                          const results: any[] = Array.isArray(sj?.results) ? sj.results : [];
                          const mapped = results.map(toRow).filter((r) => String(r.orderNumber) === String(id) || String(r.orderId) === String(id));
                          rows.push(...mapped);
                        } catch {}
                      }
                      if (rows.length > 0) {
                        if (addrCsvUrl) {
                          try { URL.revokeObjectURL(addrCsvUrl); } catch {}
                          setAddrCsvUrl(null);
                        }
                        setPerPostOrders((prev) => {
                          const seen = new Set(prev.map((r: any) => String(r.orderNumber)));
                          const merged = prev.slice();
                          for (const r of rows) {
                            const on = String(r.orderNumber);
                            if (!seen.has(on)) { seen.add(on); merged.push(r); }
                          }
                          return merged;
                        });
                        toast({ title: lang === "de" ? "Hinzugefügt" : "Added", description: `${rows.length}` });
                        setAddOrderText("");
                        setAddDialogOpen(false);
                      } else {
                        toast({ title: lang === "de" ? "Nichts hinzugefügt" : "Nothing added" });
                      }
                    }
                  } else {
                    const query = addOrderText.trim();
                    if (!query) {
                      toast({ title: lang === "de" ? "Kein Nachname" : "No last name" });
                    } else {
                      const sr = await fetchFallback("/api/orders/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ searchCriteria: { orderNumber: query } }),
                      } as any);
                      const sj = await sr.json().catch(() => ({}));
                      const results: any[] = Array.isArray(sj?.results) ? sj.results : [];
                      const matches = results
                        .map(toRow)
                        .filter((r) => String(r.lastName || "").toLowerCase().includes(query.toLowerCase()));

                      if (matches.length === 0) {
                        toast({ title: lang === "de" ? "Keine Treffer" : "No matches" });
                      } else if (matches.length === 1) {
                        const r = matches[0];
                        setPerPostOrders((prev) => {
                          const seen = new Set(prev.map((p: any) => String(p.orderNumber)));
                          if (seen.has(String(r.orderNumber))) return prev;
                          if (addrCsvUrl) {
                            try { URL.revokeObjectURL(addrCsvUrl); } catch {}
                            setAddrCsvUrl(null);
                          }
                          return [...prev, r];
                        });
                        toast({ title: lang === "de" ? "Hinzugefügt" : "Added" });
                        setAddOrderText("");
                        setAddDialogOpen(false);
                      } else {
                        setPickOptions(matches);
                        setAddDialogOpen(false);
                        setPickOpen(true);
                      }
                    }
                  }
                } finally {
                  setAddOrderLoading(false);
                }
              }}
            >
              {addOrderLoading ? (lang === "de" ? "Lädt…" : "Adding…") : (lang === "de" ? "Hinzufügen" : "Add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === "de" ? "Auswahl hinzufügen" : "Choose to add"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-auto">
            {pickOptions.map((r) => (
              <button
                key={String(r.orderNumber)}
                className="w-full text-left px-3 py-2 hover:bg-accent rounded border"
                onClick={() => {
                  setPerPostOrders((prev) => {
                    const seen = new Set(prev.map((p: any) => String(p.orderNumber)));
                    if (seen.has(String(r.orderNumber))) return prev;
                    if (addrCsvUrl) {
                      try { URL.revokeObjectURL(addrCsvUrl); } catch {}
                      setAddrCsvUrl(null);
                    }
                    return [...prev, r];
                  });
                  setPickOpen(false);
                  toast({ title: lang === "de" ? "Hinzugefügt" : "Added" });
                  setAddOrderText("");
                }}
                title={`#${r.orderNumber}`}
              >
                <div className="font-medium">{r.lastName}, {r.firstName}</div>
                <div className="text-xs text-muted-foreground">#{r.orderNumber} • {r.examType} • {r.examDate}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {showInfo && editedInfo && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="border border-border rounded-md p-4 text-sm bg-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "orderNumber", label: "Order Number" },
                { key: "lastName", label: "Last Name" },
                { key: "firstName", label: "First Name" },
                { key: "dob", label: "Birthday" },
                { key: "email", label: "Email" },
                { key: "birthLand", label: "Birth Land" },
                { key: "nationality", label: "Nationality" },
                { key: "examDate", label: "Exam Date" },
                { key: "examTime", label: "Exam Time" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="group flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-accent cursor-text"
                  onClick={() => setEditingKey(key)}
                >
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    {editingKey === key ? (
                      <Input
                        value={editedInfo?.[key] ?? ""}
                        onChange={(e) =>
                          setEditedInfo((p: any) => ({
                            ...(p || {}),
                            [key]: e.target.value,
                          }))
                        }
                        onBlur={() => setEditingKey(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.currentTarget as any).blur();
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        className="h-8"
                      />
                    ) : (
                      <div
                        className="font-medium truncate"
                        title={editedInfo?.[key] ?? ""}
                      >
                        {editedInfo?.[key] ?? ""}
                      </div>
                    )}
                  </div>
                  {editingKey === key && (
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}

              <div className="group flex items-center gap-2 border rounded-md px-3 py-2">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Exam</div>
                  <div
                    className="font-medium truncate"
                    title={`${editedInfo?.examKind ?? ""}${editedInfo?.examPart ? ` (${editedInfo.examPart})` : ""}`}
                  >
                    {`${editedInfo?.examKind ?? ""}${editedInfo?.examPart ? ` (${editedInfo.examPart})` : ""}`}
                  </div>
                </div>
              </div>

              {[
                { key: "examKind", label: "Exam kind" },
                { key: "examPart", label: "Exam part" },
                { key: "price", label: "Price" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="group flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-accent cursor-text"
                  onClick={() => setEditingKey(key)}
                >
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    {editingKey === key ? (
                      <Input
                        value={editedInfo?.[key] ?? ""}
                        onChange={(e) =>
                          setEditedInfo((p: any) => ({
                            ...(p || {}),
                            [key]: e.target.value,
                          }))
                        }
                        onBlur={() => setEditingKey(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.currentTarget as any).blur();
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        className="h-8"
                      />
                    ) : (
                      <div
                        className="font-medium truncate"
                        title={editedInfo?.[key] ?? ""}
                      >
                        {editedInfo?.[key] ?? ""}
                      </div>
                    )}
                  </div>
                  {editingKey === key && (
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}

              {/* Street and House number */}
              <div
                className="group flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-accent cursor-text"
                onClick={() => setEditingKey("streetHouse")}
              >
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">
                    Street and House number
                  </div>
                  {editingKey === "streetHouse" ? (
                    <Input
                      value={(editedInfo?.fullAddress || "")
                        .split("\n")
                        .filter(
                          (l: string) =>
                            l.trim() &&
                            l.trim() !== (editedInfo?.fullCity || "").trim(),
                        )
                        .join(" ")
                        .trim()}
                      onChange={(e) => {
                        const newStreet = e.target.value;
                        setEditedInfo((p: any) => {
                          const prev = p || {};
                          const fullCity = (prev.fullCity || "").trim();
                          const fullAddress = fullCity
                            ? `${newStreet}`.trim() + "\n" + fullCity
                            : `${newStreet}`.trim();
                          return { ...prev, fullAddress };
                        });
                      }}
                      onBlur={() => setEditingKey(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.currentTarget as any).blur();
                        if (e.key === "Escape") setEditingKey(null);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <div
                      className="font-medium truncate"
                      title={(editedInfo?.fullAddress || "")
                        .split("\n")
                        .filter(
                          (l: string) =>
                            l.trim() &&
                            l.trim() !== (editedInfo?.fullCity || "").trim(),
                        )
                        .join(" ")
                        .trim()}
                    >
                      {(editedInfo?.fullAddress || "")
                        .split("\n")
                        .filter(
                          (l: string) =>
                            l.trim() &&
                            l.trim() !== (editedInfo?.fullCity || "").trim(),
                        )
                        .join(" ")
                        .trim()}
                    </div>
                  )}
                </div>
                {editingKey === "streetHouse" && (
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Zip and City */}
              <div
                className="group flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-accent cursor-text"
                onClick={() => setEditingKey("zipCity")}
              >
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">
                    Zip and City
                  </div>
                  {editingKey === "zipCity" ? (
                    <Input
                      value={editedInfo?.fullCity ?? ""}
                      onChange={(e) => {
                        const newFullCity = e.target.value;
                        setEditedInfo((p: any) => {
                          const prev = p || {};
                          const streetPart = (prev.fullAddress || "")
                            .split("\n")
                            .filter(
                              (l: string) =>
                                l.trim() &&
                                l.trim() !== (prev.fullCity || "").trim(),
                            )
                            .join(" ")
                            .trim();
                          const fullAddress = streetPart
                            ? `${streetPart}\n${newFullCity}`
                            : newFullCity;
                          return {
                            ...prev,
                            fullCity: newFullCity,
                            fullAddress,
                          };
                        });
                      }}
                      onBlur={() => setEditingKey(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.currentTarget as any).blur();
                        if (e.key === "Escape") setEditingKey(null);
                      }}
                      className="h-8"
                    />
                  ) : (
                    <div
                      className="font-medium truncate"
                      title={editedInfo?.fullCity ?? ""}
                    >
                      {editedInfo?.fullCity ?? ""}
                    </div>
                  )}
                </div>
                {editingKey === "zipCity" && (
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
