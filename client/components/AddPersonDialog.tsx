import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type AddPersonForm = {
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
  const computedPrice = useMemo(() => computePrice({ pruefung: f.pruefung, pruefungsteil: f.pruefungsteil, zertifikat: f.zertifikat }), [f.pruefung, f.pruefungsteil, f.zertifikat]);
  React.useEffect(() => {
    if (priceLocked) {
      setF((prev) => ({ ...prev, preis: computedPrice != null ? toEuroString(computedPrice) : "" }));
    }
  }, [computedPrice, priceLocked]);

  const bookingAfterExam = useMemo(() => {
    const pd = parseDDMMYYYYToDate(f.pDatum);
    const bd = parseDDMMYYYYToDate(f.bDatum);
    if (!pd || !bd) return false;
    return bd.getTime() > pd.getTime();
  }, [f.pDatum, f.bDatum]);

  const canSubmit = useMemo(() => {
    return Boolean(f.nachname && f.vorname && f.pruefung && f.pruefungsteil && f.status);
  }, [f]);

  const reset = () => {
    setF({
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
              <Label className="block relative -top-2">Geburtsort</Label>
              <Input value={f.geburtsort} onChange={(e) => setF({ ...f, geburtsort: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Geburtsland</Label>
              <Input value={f.geburtsland} onChange={(e) => setF({ ...f, geburtsland: sanitizeNameInput(e.target.value) })} />
            </div>
            <div>
              <Label className="block relative -top-2">Email</Label>
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div>
              <Label className="block relative -top-2">Tel.Nr.</Label>
              <Input value={f.telefon} onChange={(e) => setF({ ...f, telefon: onlyDigits(e.target.value) })} inputMode="numeric" />
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
                <Label className="m-0 relative -top-2">B.Datum</Label>
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
