import type { RequestHandler } from "express";
import { z } from "zod";
import { getWooConfig } from "./woocommerce-config";

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const requestSchema = z.object({
  orderNumbers: z.array(z.union([z.string(), z.number()])).min(1),
  templateUrl: z.string().url(),
});

function normalizeMetaKey(key: string): string {
  const s = key.toString().trim().replace(/:$/u, "");
  const lower = s.toLowerCase();
  return lower
    .replace(/\(.*?\)/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  "level",
];
const META_KEYS_EXAM_PART = [
  "prüfungsteil",
  "pruefungsteil",
  "exam_part",
  "exam part",
  "teilnahmeart",
  "teilnahme",
];

function extractFromMeta(meta: Record<string, any>, keys: string[]): string | undefined {
  const normalized = Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [normalizeMetaKey(k), v]),
  );
  for (const k of keys) {
    const nk = normalizeMetaKey(k);
    const v = normalized[nk];
    if (v != null && String(v).trim().length > 0) return String(v);
  }
  return undefined;
}

async function fetchOrderRaw(
  baseUrl: string,
  key: string,
  secret: string,
  id: string | number,
): Promise<any | null> {
  try {
    const url = new URL(`/wp-json/wc/v3/orders/${id}`, baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export const generateRegistrationDocx: RequestHandler = async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
    }
    const { orderNumbers, templateUrl } = parsed.data;
    const orderId = orderNumbers[0];

    const wooConfig = getWooConfig();
    if (!wooConfig) {
      return res.status(400).json({ message: "WooCommerce not configured. Please configure WooCommerce settings in Settings > WooCommerce." });
    }
    const { baseUrl, consumerKey, consumerSecret } = wooConfig;

    const order = await fetchOrderRaw(baseUrl, consumerKey, consumerSecret, orderId);
    if (!order) return res.status(404).json({ message: `Order ${orderId} not found` });

    const meta: Record<string, any> = {};
    const coerceVal = (v: any): string => {
      if (v == null) return "";
      if (typeof v === "string" || typeof v === "number") return String(v);
      if (Array.isArray(v)) return v.map(coerceVal).filter(Boolean).join(", ");
      if (typeof v === "object") {
        if ((v as any).label) return String((v as any).label);
        if ((v as any).value) return coerceVal((v as any).value);
        try { return JSON.stringify(v); } catch { return String(v); }
      }
      return String(v);
    };
    const addMeta = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      for (const m of arr) {
        const rawK = (m?.key ?? m?.name ?? m?.display_key ?? "").toString();
        const k = normalizeMetaKey(rawK);
        const valRaw = m?.value ?? m?.display_value ?? m?.option ?? "";
        const v = coerceVal(valRaw);
        if (k) meta[k] = v;
        const displayKey = m?.display_key ? normalizeMetaKey(String(m.display_key)) : "";
        if (displayKey) meta[displayKey] = v;
        if (valRaw && typeof valRaw === "object" && (valRaw as any).label) {
          const lk = normalizeMetaKey(String((valRaw as any).label));
          const lv = coerceVal((valRaw as any).value ?? (valRaw as any).display_value ?? "");
          if (lk) meta[lk] = lv;
        }
      }
    };
    addMeta(order?.meta_data || []);
    (order?.line_items || []).forEach((li: any) => addMeta(li?.meta_data || []));

    const billing = order?.billing || {};

    const examDate = extractFromMeta(meta, META_KEYS_EXAM_DATE) || "";
    const examKind = extractFromMeta(meta, META_KEYS_EXAM_KIND) || "";
    const pickPart = (s: string) => {
      const lc = (s || "").toLowerCase();
      if (lc.includes("mündlich") || lc.includes("muendlich")) return "nur mündlich";
      if (lc.includes("schriftlich")) return "nur schriftlich";
      return "Gesamt";
    };
    const examPart = pickPart(extractFromMeta(meta, META_KEYS_EXAM_PART) || examKind);

    const data = {
      orderNumber: order?.number ?? String(order?.id ?? orderId),
      firstName: billing?.first_name || "",
      lastName: billing?.last_name || "",
      email: billing?.email || "",
      phone: billing?.phone || "",
      address1: billing?.address_1 || "",
      address2: billing?.address_2 || "",
      city: billing?.city || "",
      zip: billing?.postcode || "",
      country: billing?.country || "",
      examKind,
      examPart,
      examDate,
      bookingDate: order?.date_created || "",
      paymentMethod: order?.payment_method_title || order?.payment_method || "",
    } as Record<string, any>;

    const tmplRes = await fetch(templateUrl);
    if (!tmplRes.ok) return res.status(400).json({ message: `Failed to download template (${tmplRes.status})` });
    const arrayBuffer = await tmplRes.arrayBuffer();
    const zip = new PizZip(Buffer.from(arrayBuffer));
    try {
      const xmlFiles = zip.file(/word\/.+\.xml$/i) || [];
      for (const f of xmlFiles as any[]) {
        const name = (f as any).name || (f as any).options?.name;
        if (!name) continue;
        const content = zip.file(name)!.asText();
        const cleaned = content
          .replace(/\{\{\{+/g, "{{")
          .replace(/\}+\}\}/g, "}}")
          .replace(/\{\s+\{/g, "{{")
          .replace(/\}\s+\}/g, "}}");
        if (cleaned !== content) zip.file(name, cleaned);
      }
    } catch {}

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.setData(data);
    try {
      doc.render();
    } catch (e: any) {
      // Try once more with soft error handling already enabled
      try {
        doc.render();
      } catch (e2: any) {
        return res.status(400).json({ message: `Template render failed: ${e2?.message || e2}` });
      }
    }
    const buf = doc.getZip().generate({ type: "nodebuffer" });

    const filename = `registration-${data.orderNumber}.docx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Failed to generate DOCX" });
  }
};
