// Lightweight TypeScript mapper inspired by the provided Java OrderMapper
// Focused on fields needed for the orders list: order number, names, exam part, exam date, booking date, payment method

export type ListRow = {
  id: number;
  number: string;
  billingFirstName: string;
  billingLastName: string;
  examPart: string;
  examDate: string;
  bookingDate: string;
  paymentMethod: string;
};

const META_KEYS_EXAM_DATE = [
  "exam_date",
  "pruefungsdatum",
  "prüfungsdatum",
  "prüfungstermin",
  "termin",
  "prüfungstermin wählen",
  "prüfungstermin wählen:",
  "prüfungs termin wählen",
  "choose exam date",
  "choose exam date:",
];

const META_KEYS_EXAM_PART = [
  "prüfungsteil",
  "pruefungsteil",
  "exam_part",
  "exam part",
  "teilnahmeart",
  "teilnahme",
];

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addMeta(meta: Record<string, any>, arr: any[]) {
  if (!Array.isArray(arr)) return;
  for (const m of arr) {
    const rawK = (m?.key ?? m?.name ?? m?.display_key ?? "").toString();
    const k = normalizeKey(rawK);
    const valRaw = m?.value ?? m?.display_value ?? m?.option ?? "";
    const v = coerce(valRaw);
    if (k) meta[k] = v;
    const displayKey = m?.display_key
      ? normalizeKey(String(m.display_key))
      : "";
    if (displayKey) meta[displayKey] = v;
    if (valRaw && typeof valRaw === "object" && (valRaw as any).label) {
      const lk = normalizeKey(String((valRaw as any).label));
      const lv = coerce(
        (valRaw as any).value ?? (valRaw as any).display_value ?? "",
      );
      if (lk) meta[lk] = lv;
    }
  }
}

function coerce(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(coerce).filter(Boolean).join(", ");
  if (typeof v === "object") {
    if ((v as any).label) return String((v as any).label);
    if ((v as any).value) return coerce((v as any).value);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function extractFromMeta(
  meta: Record<string, any>,
  keys: string[],
): string | undefined {
  const normalized = Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [normalizeKey(k), v]),
  );
  for (const k of keys) {
    const nk = normalizeKey(k);
    const v = normalized[nk];
    if (v != null && String(v).trim().length > 0) return String(v);
  }
  return undefined;
}

function nameCase(s: string): string {
  const str = String(s || "").toLowerCase();
  return str
    .split(/([\s-]+)/)
    .map((p) =>
      /^[\s-]+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join("");
}

function formatDateDE(input: string | undefined): string {
  const s = String(input || "").trim();
  if (!s) return "";
  // Accept ISO or DD.MM.YYYY or YYYY-MM-DD
  // Try ISO
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE");
  }
  // Try DD.MM.YYYY passthrough
  const m = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
  if (m) return s;
  return s;
}

const META_KEYS_EXAM_KIND = [
  "pruefungstyp",
  "prüfungstyp",
  "exam_type",
  "exam_kind",
  "type",
  "typ",
  "teilnahmeart",
  "pruefung_art",
  "prüfungsart",
  "pruefungsart",
];

function normalizeExamPart(meta: Record<string, any>): string {
  const rawPart = (
    extractFromMeta(meta, META_KEYS_EXAM_PART) || ""
  ).toLowerCase();
  const rawKind = (
    extractFromMeta(meta, META_KEYS_EXAM_KIND) || ""
  ).toLowerCase();
  const scan = (s: string) =>
    s.includes("mündlich") || s.includes("muendlich")
      ? "nur mündlich"
      : s.includes("schriftlich")
        ? "nur schriftlich"
        : "";
  return scan(rawPart) || scan(rawKind) || "Gesamt";
}

export function mapOrderToListRow(order: any): ListRow {
  const meta: Record<string, any> = {};
  addMeta(meta, order?.meta_data || []);
  (order?.line_items || []).forEach((li: any) =>
    addMeta(meta, li?.meta_data || []),
  );

  const billing = order?.billing || {};
  const number = order?.number ?? String(order?.id ?? "");
  const examDateRaw = extractFromMeta(meta, META_KEYS_EXAM_DATE) || "";

  return {
    id: order?.id,
    number,
    billingFirstName: nameCase(billing?.first_name || ""),
    billingLastName: nameCase(billing?.last_name || ""),
    examPart: normalizeExamPart(meta),
    examDate: formatDateDE(examDateRaw),
    bookingDate: order?.date_created ?? "",
    paymentMethod: order?.payment_method_title ?? order?.payment_method ?? "",
  };
}
