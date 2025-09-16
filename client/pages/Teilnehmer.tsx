import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useI18n } from "@/lib/i18n";
import { Pencil } from "lucide-react";
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
  const [selectedExam, setSelectedExam] = useState<{
    id: number;
    kind: string;
    date: string;
  } | null>(null);
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

  // Fetch school address when showing address section
  useEffect(() => {
    if (!showAddress) return;
    (async () => {
      try {
        const r = await fetchFallback("/api/school/address");
        const j = await r.json().catch(() => ({}));
        setSchoolAddress(j?.address || null);
      } catch {}
    })();
  }, [showAddress]);

  // Robust fetch helper that tries multiple candidate base paths (useful when the API is proxied)
  async function fetchFallback(
    input: RequestInfo | string,
    init?: RequestInit,
  ) {
    const path =
      typeof input === "string" ? input : ((input as any).url ?? String(input));
    const candidates: string[] = [];
    if (path.startsWith("/")) {
      candidates.push(path);
      try {
        candidates.push(window.location.origin + path);
      } catch {}
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
        lastErr = e;
      }
    }
    throw lastErr;
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
                  variant={selectedExam ? "default" : "outline"}
                  className={
                    selectedExam
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
                  {selectedExam
                    ? `${selectedExam.kind} – ${formatDateDDMMYYYY(selectedExam.date)}`
                    : "Choose an Exam"}
                </Button>
              </div>
              <div className="flex md:flex-col gap-2 md:w-60">
                <Button
                  variant={addrCsvUrl ? "default" : "outline"}
                  className={
                    addrCsvUrl
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : undefined
                  }
                  disabled={
                    loading || addrMaking || (!addrCsvUrl && !perPostSearched)
                  }
                  onClick={async () => {
                    if (!selectedExam) {
                      toast({
                        title: "Exam required",
                        description: "Choose an exam first.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (addrCsvUrl) {
                      try {
                        const a = document.createElement("a");
                        a.href = addrCsvUrl;
                        const safeKind = selectedExam.kind.replace(
                          /[^A-Za-z0-9_-]+/g,
                          "_",
                        );
                        const safeDate = formatDateDDMMYYYY(
                          selectedExam.date,
                        ).replace(/[^0-9.]+/g, "");
                        a.download = `address-post-list_${safeKind}_${safeDate}.xlsx`;
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

                      const data: (string | number)[][] = [
                        headers,
                        ...rows,
                        ...repeatedSchool,
                      ];
                      const ws = XLSX.utils.aoa_to_sheet(data);
                      // Optional: set column widths for readability
                      const colWidths = [20, 18, 28, 14, 10, 20].map((w) => ({
                        wch: w,
                      }));
                      (ws as any)["!cols"] = colWidths;
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Addresses");
                      const out = XLSX.write(wb, {
                        bookType: "xlsx",
                        type: "array",
                      });

                      const blob = new Blob([out], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      });
                      const url = URL.createObjectURL(blob);
                      setAddrCsvUrl(url);
                      toast({
                        title: isDE ? "Liste bereit" : "List ready",
                        description: isDE
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

                <Button
                  variant="secondary"
                  className={
                    perPostLoading ? "btn-glow-fade btn-loading" : undefined
                  }
                  disabled={loading || perPostLoading}
                  onClick={async () => {
                    if (!selectedExam) {
                      toast({
                        title: "Exam required",
                        description: "Choose an exam first.",
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
                                body: JSON.stringify({
                                  id,
                                  kind: selectedExam.kind,
                                  date: selectedExam.date,
                                }),
                                signal,
                              } as any,
                            );
                            const cj = await cr.json().catch(() => ({}));
                            if (signal.aborted) {
                              stop = true;
                              break;
                            }
                            if (cr.ok && cj?.match && cj?.row) {
                              setPerPostOrders((prev) => [...prev, cj.row]);
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
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id,
                                          kind: selectedExam!.kind,
                                          date: selectedExam!.date,
                                        }),
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
                              await Promise.all(
                                Array.from(
                                  { length: Math.min(limit, list.length) },
                                  () => run(),
                                ),
                              );
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
            <DialogTitle>Choose an Exam</DialogTitle>
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
                            {arr.map((ex) => (
                              <button
                                key={ex.id}
                                className="w-full text-left px-2 py-1 hover:bg-accent rounded"
                                onClick={() => {
                                  setSelectedExam(ex);
                                  setChooseExamOpen(false);
                                }}
                              >
                                {formatDateDDMMYYYY(ex.date)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div>
                    {list.map((ex) => (
                      <button
                        key={ex.id}
                        className="w-full text-left px-2 py-1 hover:bg-accent border-b last:border-b-0"
                        onClick={() => {
                          setSelectedExam(ex);
                          setChooseExamOpen(false);
                        }}
                      >
                        <span className="inline-block w-10 font-mono">
                          {ex.kind}
                        </span>{" "}
                        {formatDateDDMMYYYY(ex.date)}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
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
