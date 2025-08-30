import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Pencil, Check, X, ExternalLink, Loader2 } from "lucide-react";
import { COUNTRIES, COUNTRY_MAP } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type AddPersonForm = {
  bestellnummer: string;
  nachname: string;
  vorname: string;
  geburtsdatum: string; // DD.MM.YYYY
  geburtsort: string;
  geburtsland: string;
  email: string;
  telefon: string;
  pruefung: "B1" | "B2" | "C1" | "";
  pruefungsteil: "Gesamt" | "Mündlich" | "Schriftlich" | "";
  zertifikat: "Abholen" | "Per Post" | "";
  pDatum: string; // DD.MM.YYYY
  bDatum: string; // DD.MM.YYYY
  preis: string;
  zahlungsart: "Überweisung" | "Bar" | "";
  status: "Offen" | "Bezahlt";
  mitarbeiter?: string;
};

export function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildRow(headers: string[], data: AddPersonForm) {
  const row = new Array(headers.length).fill("");
  const setBy = (pred: (k: string) => boolean, val: string) => {
    const idx = headers.findIndex((h) => pred(normalizeHeader(String(h))));
    if (idx >= 0) row[idx] = val;
  };

  setBy((k) => k.includes("nachname"), data.nachname);
  setBy((k) => k.includes("vorname"), data.vorname);
  setBy((k) => k.includes("bestell"), data.bestellnummer);
  setBy((k) => k.includes("geburtsdatum") || k.includes("geburtsdat"), data.geburtsdatum);
  setBy((k) => k.includes("geburtsort"), data.geburtsort);
  setBy((k) => k.includes("geburtsland"), data.geburtsland);
  setBy((k) => k.includes("email") || k.includes("e mail") || k.includes("mail"), data.email);
  setBy((k) => k.includes("tel") || k.includes("telefon") || k.includes("phone"), data.telefon);
  setBy((k) => k.includes("prufungsteil"), data.pruefungsteil);
  setBy((k) => k.includes("prufung") && !k.includes("prufungsteil"), data.pruefung);
  setBy((k) => k.includes("zertifikat"), data.zertifikat);
  setBy((k) => k.includes("pdatum"), data.pDatum);
  setBy((k) => k.includes("bdatum"), data.bDatum);
  setBy((k) => k.includes("preis"), data.preis);
  setBy((k) => k.includes("zahlungsart") || k.includes("zahlung"), data.zahlungsart);
  setBy((k) => k.includes("status"), data.status);
  setBy((k) => k.includes("mitarbeiter") || k.includes("bearbeiter") || k.includes("user"), data.mitarbeiter || "");

  return row;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseFlexibleToDDMMYYYY(input: string): string | null {
  const s = input.trim();
  const m1 = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m1) {
    const dd = Math.max(1, Math.min(31, Number(m1[1])));
    const mm = Math.max(1, Math.min(12, Number(m1[2])));
    const yyyy = Number(m1[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${pad2(dd)}.${pad2(mm)}.${yyyy}`;
    return null;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4));
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return `${pad2(dd)}.${pad2(mm)}.${yyyy}`;
  }
  return null;
}

function parseDDMMYYYYToDate(s: string): Date | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
  return null;
}

function basePriceFor(pruefung: AddPersonForm["pruefung"]): number | null {
  if (pruefung === "B1" || pruefung === "B2") return 179;
  if (pruefung === "C1") return 189; // C1 HS
  return null;
}

function computePrice({ pruefung, pruefungsteil, zertifikat }: Pick<AddPersonForm, "pruefung" | "pruefungsteil" | "zertifikat">): number | null {
  const base = basePriceFor(pruefung);
  if (base == null) return null;
  let price = base;
  if (pruefungsteil === "Mündlich" || pruefungsteil === "Schriftlich") price = price * 0.9;
  if (zertifikat === "Per Post") price = price + 8;
  return Math.round(price * 100) / 100;
}

function toEuroString(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function capitalizeWords(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function sanitizeNameInput(s: string): string {
  const cleaned = s.replace(/[^\p{L}\s\-']/gu, "");
  return capitalizeWords(cleaned);
}

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}
function stripLeadingZeros(s: string): string {
  return s.replace(/^0+/, "");
}

function formatDateMasked(s: string): string {
  const digits = onlyDigits(s).slice(0, 8);
  let out = digits;
  if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  else if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return out;
}

function sanitizePriceInput(s: string): string {
  const replaced = s.replace(/\./g, ",");
  const kept = replaced.replace(/[^0-9,]/g, "");
  const parts = kept.split(",");
  if (parts.length === 1) return parts[0];
  return parts[0] + "," + parts.slice(1).join("").slice(0, 2);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#','').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function relLuminance(hex: string): number {
  const rgb = hexToRgb(hex) || { r: 127, g: 127, b: 127 } as any;
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function bestTextColorFrom(colors?: [string, string]): { color: string; overlay: string } {
  const base = colors?.[0] || "#666666";
  const L = relLuminance(base);
  if (L > 0.5) return { color: "#111111", overlay: "rgba(255,255,255,0.25)" };
  return { color: "#ffffff", overlay: "rgba(0,0,0,0.35)" };
}

function isValidEmail(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Simple robust email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t);
}

function colIndexToA1(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export default function AddPersonDialog({
  open,
  onOpenChange,
  sheetId,
  sheetTitle,
  headers,
  apiAvailable = true,
  apiBase = "/api",
  onAppended,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sheetId: string | null;
  sheetTitle: string | null;
  headers: string[] | null;
  apiAvailable?: boolean;
  apiBase?: string;
  onAppended?: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState<AddPersonForm>({
    bestellnummer: "",
    nachname: "",
    vorname: "",
    geburtsdatum: "",
    geburtsort: "",
    geburtsland: "",
    email: "",
    telefon: "",
    pruefung: "",
    pruefungsteil: "",
    zertifikat: "",
    pDatum: "",
    bDatum: "",
    preis: "",
    zahlungsart: "",
    status: "Offen",
    mitarbeiter: "",
  });

  const [priceLocked, setPriceLocked] = useState(true);
  const [showPriceEdit, setShowPriceEdit] = useState(false);

  const [bestellStatus, setBestellStatus] = useState<"idle" | "checking" | "unique" | "duplicate" | "no-col" | "error">("idle");
  const [bestellFoundRow, setBestellFoundRow] = useState<number | null>(null);
  const [bestellLink, setBestellLink] = useState<string | null>(null);

  const [phoneCountry, setPhoneCountry] = useState("DE");
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const displayCountry = hoverCountry || phoneCountry;
  const phoneDial = useMemo(() => COUNTRY_MAP[phoneCountry]?.dial || "+49", [phoneCountry]);
  const [phoneLocal, setPhoneLocal] = useState("");

  const computedPrice = useMemo(() => computePrice({ pruefung: f.pruefung, pruefungsteil: f.pruefungsteil, zertifikat: f.zertifikat }), [f.pruefung, f.pruefungsteil, f.zertifikat]);
  React.useEffect(() => {
    if (priceLocked) {
      setF((prev) => ({ ...prev, preis: computedPrice != null ? toEuroString(computedPrice) : "" }));
    }
  }, [computedPrice, priceLocked]);

  React.useEffect(() => {
    setF((prev) => ({ ...prev, telefon: `${phoneDial}${phoneLocal}` }));
  }, [phoneDial, phoneLocal]);

  const bookingAfterExam = useMemo(() => {
    const pd = parseDDMMYYYYToDate(f.pDatum);
    const bd = parseDDMMYYYYToDate(f.bDatum);
    if (!pd || !bd) return false;
    return bd.getTime() > pd.getTime();
  }, [f.pDatum, f.bDatum]);

  const emailInvalid = useMemo(() => f.email.trim().length > 0 && !isValidEmail(f.email), [f.email]);

  React.useEffect(() => {
    let alive = true;
    async function run() {
      if (!sheetId) return;
      const digits = onlyDigits(f.bestellnummer).slice(0, 4);
      if (digits.length !== 4) { setBestellStatus("idle"); setBestellFoundRow(null); setBestellLink(null); return; }
      setBestellStatus("checking");
      try {
        const tabsRes = await fetch(`${apiBase}/sheets/tabs?id=${encodeURIComponent(sheetId)}`);
        if (!tabsRes.ok) throw new Error("tabs failed");
        const tabsJson = await tabsRes.json();
        const tabs: { title: string; gid: string }[] = tabsJson?.sheets || [];

        const findBestellIndex = (row: string[]): number => {
          return row.findIndex((h) => {
            const n = normalizeHeader(h || "");
            return (
              n.includes("bestell") ||
              n.includes("order") ||
              n.includes("order number") ||
              n.includes("b nr") ||
              n.includes("b-nr") ||
              n.includes("bnr")
            );
          });
        };

        for (const tab of tabs) {
          // Fetch header and a sample block to detect 4-digit-only columns
          const sampleRes = await fetch(`${apiBase}/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent("A1:ZZ200")}`);
          if (!sampleRes.ok) continue;
          const sampleJson = await sampleRes.json();
          const rows: string[][] = (sampleJson?.values as string[][]) || [];
          const headRow: string[] = rows[0] || [];
          const maxCols = headRow.length || Math.max(0, ...rows.map((r) => r.length));

          const candidates = new Set<number>();
          const headerIdx = findBestellIndex(headRow);
          if (headerIdx >= 0) candidates.add(headerIdx);

          for (let c = 0; c < maxCols; c++) {
            let ok = true;
            for (let r = 1; r < rows.length; r++) {
              const cell = String((rows[r] && rows[r][c]) ?? "").trim();
              if (!cell) continue;
              const d = onlyDigits(cell);
              if (d.length !== 4 || d.length !== cell.replace(/\s+/g, "").length) { ok = false; break; }
            }
            if (ok) candidates.add(c);
          }

          // Search each candidate column in full height
          for (const idx of candidates) {
            const col = colIndexToA1(idx);
            const range = `${col}1:${col}100000`;
            const res = await fetch(`${apiBase}/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(range)}`);
            if (!res.ok) continue;
            const json = await res.json();
            const values: any[][] = json?.values || [];
            let foundRow: number | null = null;
            for (let r = 1; r < values.length; r++) {
              const cell = String(values[r]?.[0] ?? "");
              const cellDigits = onlyDigits(cell).slice(0, 4);
              if (cellDigits === digits) { foundRow = r + 1; break; }
            }
            if (!alive) return;
            if (foundRow) {
              const a1 = `${col}${foundRow}`;
              const link = tab.gid ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit#gid=${encodeURIComponent(tab.gid)}&range=${encodeURIComponent(a1)}` : null;
              setBestellStatus("duplicate");
              setBestellFoundRow(foundRow);
              setBestellLink(link);
              return;
            }
          }
        }
        if (!alive) return;
        setBestellStatus("unique");
        setBestellFoundRow(null);
        setBestellLink(null);
      } catch (e) {
        if (!alive) return;
        setBestellStatus("error");
        setBestellFoundRow(null);
        setBestellLink(null);
      }
    }
    const t = setTimeout(run, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [f.bestellnummer, sheetId, apiBase]);

  const canSubmit = useMemo(() => {
    const emailValid = isValidEmail(f.email);
    const datesValid = Boolean(
      f.geburtsdatum && f.pDatum && f.bDatum &&
      parseFlexibleToDDMMYYYY(f.geburtsdatum) &&
      parseFlexibleToDDMMYYYY(f.pDatum) &&
      parseFlexibleToDDMMYYYY(f.bDatum)
    );
    const requiredFilled = Boolean(
      onlyDigits(f.bestellnummer).length === 4 && f.nachname && f.vorname && f.geburtsdatum && f.geburtsort && f.geburtsland &&
      f.email && f.pruefung && f.pruefungsteil && f.zertifikat && f.pDatum && f.bDatum &&
      f.preis && f.zahlungsart && f.status && phoneLocal.trim().length > 0
    );
    return requiredFilled && datesValid && emailValid;
  }, [f, phoneLocal]);

  const reset = () => {
    setF({
      bestellnummer: "",
      nachname: "",
      vorname: "",
      geburtsdatum: "",
      geburtsort: "",
      geburtsland: "",
      email: "",
      telefon: "",
      pruefung: "",
      pruefungsteil: "",
      zertifikat: "",
      pDatum: "",
      bDatum: "",
      preis: "",
      zahlungsart: "",
      status: "Offen",
      mitarbeiter: "",
    });
    setPriceLocked(true);
    setShowPriceEdit(false);
    setPhoneCountry("DE");
    setPhoneLocal("");
    setBestellStatus("idle");
    setBestellFoundRow(null);
    setBestellLink(null);
  };

  async function handleSubmit() {
    if (!apiAvailable) {
      toast({ title: "Backend nicht verfügbar", description: "Die Verbindung zum API-Server ist aktuell nicht möglich.", variant: "destructive" });
      return;
    }
    if (!apiBase) {
      toast({ title: "API nicht gefunden", description: "Konnte keinen API-Endpunkt ermitteln.", variant: "destructive" });
      return;
    }
    if (!sheetId || !sheetTitle || !headers) {
      toast({ title: "Kein Sheet ausgewählt", description: "Bitte wählen Sie ein gültiges Tabellenblatt aus.", variant: "destructive" });
      return;
    }
    // Standardize date strings before submit
    const geb = f.geburtsdatum ? parseFlexibleToDDMMYYYY(f.geburtsdatum) : "";
    const pd = f.pDatum ? parseFlexibleToDDMMYYYY(f.pDatum) : "";
    const bd = f.bDatum ? parseFlexibleToDDMMYYYY(f.bDatum) : "";
    if ((f.geburtsdatum && !geb) || (f.pDatum && !pd) || (f.bDatum && !bd)) {
      toast({ title: "Ungültiges Datum", description: "Bitte verwenden Sie das Format TT.MM.JJJJ.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const row = buildRow(headers, { ...f, geburtsdatum: geb || "", pDatum: pd || "", bDatum: bd || "" });
      const res = await fetch(`${apiBase}/sheets/append`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheetId, title: sheetTitle, row }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Fehler ${res.status}`);
      }
      toast({ title: "Hinzugefügt", description: "Der Eintrag wurde zur Tabelle hinzugefügt." });
      onOpenChange(false);
      reset();
      onAppended?.();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message || "Konnte nicht speichern.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[80vh] overflow-y-auto themed-scroll">
        <DialogHeader>
          <DialogTitle>Person hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block relative -top-2">Bestellnummer</Label>
              <Input
                value={f.bestellnummer}
                onChange={(e) => setF({ ...f, bestellnummer: onlyDigits(e.target.value).slice(0, 4) })}
                onBlur={(e) => setF({ ...f, bestellnummer: onlyDigits(e.target.value).slice(0, 4) })}
                placeholder="0000"
                inputMode="numeric"
                pattern="^\\d{4}$"
                maxLength={4}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="block relative -top-2 opacity-0 select-none">&nbsp;</Label>
                {bestellStatus === "duplicate" && (
                  <div className="flex items-center gap-2 text-red-500">
                    <span>Bestellnummer existiert</span>
                    {bestellLink && (
                      <a
                        href={bestellLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs underline"
                        aria-label="In Google Sheet anzeigen"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="h-9 rounded-md border relative flex overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div className={cn("flex-1 flex items-center justify-center text-xs", bestellStatus === "unique" ? "bg-green-500/15 text-green-600" : "")}
                     aria-label="Bestellnummer ist frei">
                  {bestellStatus === "unique" ? <Check className="h-4 w-4" /> : null}
                </div>
                <div className={cn("flex-1 flex items-center justify-center text-xs", bestellStatus === "duplicate" ? "bg-red-500/15 text-red-600" : "")}
                     aria-label="Bestellnummer existiert">
                  {bestellStatus === "duplicate" ? <X className="h-4 w-4" /> : null}
                </div>
                {bestellStatus === "checking" ? (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
            <div>
              <Label className="block relative -top-2">Nachname</Label>
              <Input value={f.nachname} onChange={(e) => setF({ ...f, nachname: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Vorname</Label>
              <Input value={f.vorname} onChange={(e) => setF({ ...f, vorname: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Geburtsdatum</Label>
              <Input
                value={f.geburtsdatum}
                onChange={(e) => setF({ ...f, geburtsdatum: formatDateMasked(e.target.value) })}
                onBlur={(e) => { const p = parseFlexibleToDDMMYYYY(e.currentTarget.value); if (p) setF((prev) => ({ ...prev, geburtsdatum: p })); }}
                placeholder="TT.MM.JJJJ"
                inputMode="numeric"
                pattern="^\\d{2}\\.\\d{2}\\.\\d{4}$"
                maxLength={10}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <Label className={cn("block relative -top-2", emailInvalid ? "text-amber-500" : undefined)}>Email</Label>
                {emailInvalid && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-amber-500 hover:text-amber-600"
                          aria-label="Bitte eine gültige E-Mail eingeben!"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Bitte eine gültige E-Mail eingeben!</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="block relative -top-2">Geburtsland</Label>
              <Input value={f.geburtsland} onChange={(e) => setF({ ...f, geburtsland: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Geburtsort</Label>
              <Input value={f.geburtsort} onChange={(e) => setF({ ...f, geburtsort: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Tel.Nr.</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-9 rounded-md border overflow-hidden shrink-0"
                  style={{
                    backgroundImage: `url(https://flagcdn.com/w80/${(displayCountry || 'DE').toLowerCase()}.png)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  aria-label={`${COUNTRY_MAP[displayCountry || phoneCountry]?.name} flag`}
                  title={COUNTRY_MAP[displayCountry || phoneCountry]?.name}
                />
                <Select
                  value={phoneCountry}
                  onOpenChange={(o) => { if (!o) setHoverCountry(null); }}
                  onValueChange={(v) => { setPhoneCountry(v); setHoverCountry(null); }}
                >
                  <SelectTrigger className="w-[120px]">
                    <span className="font-semibold">{COUNTRY_MAP[phoneCountry]?.dial}</span>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {COUNTRIES.map((c) => (
                      <SelectItem
                        key={c.code}
                        value={c.code}
                        onMouseEnter={() => setHoverCountry(c.code)}
                        onMouseLeave={() => setHoverCountry(null)}
                      >
                        {`${c.dial} ${c.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value.replace(/\D+/g, ""))}
                  onBlur={() => setPhoneLocal((v) => stripLeadingZeros(v))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setPhoneLocal((v) => stripLeadingZeros(v)); (e.currentTarget as HTMLInputElement).blur(); } }}
                  inputMode="numeric"
                  placeholder="Telefonnummer"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block relative -top-2">Prüfung</Label>
              <Select value={f.pruefung} onValueChange={(v) => setF({ ...f, pruefung: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block relative -top-2">Prüfungsteil</Label>
              <Select value={f.pruefungsteil} onValueChange={(v) => setF({ ...f, pruefungsteil: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gesamt">Gesamt</SelectItem>
                  <SelectItem value="Mündlich">Mündlich</SelectItem>
                  <SelectItem value="Schriftlich">Schriftlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block relative -top-2">Zertifikat</Label>
              <Select value={f.zertifikat} onValueChange={(v) => setF({ ...f, zertifikat: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Abholen">Abholen</SelectItem>
                  <SelectItem value="Per Post">Per Post</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block relative -top-2">P.Datum</Label>
              <Input
                value={f.pDatum}
                onChange={(e) => setF({ ...f, pDatum: formatDateMasked(e.target.value) })}
                onBlur={(e) => { const p = parseFlexibleToDDMMYYYY(e.currentTarget.value); if (p) setF((prev) => ({ ...prev, pDatum: p })); }}
                placeholder="TT.MM.JJJJ"
                inputMode="numeric"
                pattern="^\\d{2}\\.\\d{2}\\.\\d{4}$"
                maxLength={10}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <Label className={cn("m-0 relative -top-2", bookingAfterExam ? "text-amber-500" : undefined)}>B.Datum</Label>
                {bookingAfterExam && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="relative -top-2 text-amber-500 hover:text-amber-600"
                          aria-label="Buchungsdatum sollte vor dem Prüfungsdatum sein!"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Buchungsdatum sollte vor dem Prüfungsdatum sein!
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                value={f.bDatum}
                onChange={(e) => setF({ ...f, bDatum: formatDateMasked(e.target.value) })}
                onBlur={(e) => { const p = parseFlexibleToDDMMYYYY(e.currentTarget.value); if (p) setF((prev) => ({ ...prev, bDatum: p })); }}
                placeholder="TT.MM.JJJJ"
                inputMode="numeric"
                pattern="^\\d{2}\\.\\d{2}\\.\\d{4}$"
                maxLength={10}
              />
            </div>
            <div>
              <Label className="block relative -top-2">Preis</Label>
              <div className="relative">
                <Input
                  value={f.preis}
                  readOnly={priceLocked}
                  onClick={() => setShowPriceEdit(true)}
                  onBlur={() => setTimeout(() => setShowPriceEdit(false), 150)}
                  onChange={(e) => setF({ ...f, preis: sanitizePriceInput(e.target.value) })}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="pr-16"
                />
                {showPriceEdit && priceLocked && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-8 flex items-center text-muted-foreground hover:text-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setPriceLocked(false); setShowPriceEdit(false); }}
                    aria-label="Preis bearbeiten"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-muted-foreground">€</span>
              </div>
            </div>
            <div>
              <Label className="block relative -top-2">Zahlungsart</Label>
              <Select value={f.zahlungsart} onValueChange={(v) => setF({ ...f, zahlungsart: v as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Überweisung">Überweisung</SelectItem>
                  <SelectItem value="Bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block relative -top-2">Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offen">Offen</SelectItem>
                  <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="block relative -top-2">Mitarbeiter</Label>
              <Input value={f.mitarbeiter || ""} onChange={(e) => setF({ ...f, mitarbeiter: e.target.value })} placeholder="Wird später automatisch gesetzt" disabled />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting || !apiAvailable}>Hinzufügen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
