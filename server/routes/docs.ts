import type { RequestHandler } from "express";
import { z } from "zod";
import { getWooConfig } from "./woocommerce-config";

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { RequestHandler } from "express";
import fs from "fs/promises";
import path from "path";

const requestSchema = z.object({
  orderNumbers: z.array(z.union([z.string(), z.number()])).min(1),
  templateUrl: z.string().url().optional(),
});

const TEMPLATE_DIR = "data/docs/templates";
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, "registration.docx");

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

const META_KEYS_DOB = [
  "dob",
  "date_of_birth",
  "geburtsdatum",
  "geburtstag",
  "birth_date",
  "billing_dob",
  "billing_birthdate",
  "_billing_birthdate",
  "birthday",
];

const META_KEYS_NATIONALITY = [
  "nationalitaet",
  "nationalität",
  "staatsangehoerigkeit",
  "staatsangehörigkeit",
  "nationality",
];

const META_KEYS_BIRTH_PLACE = [
  "geburtsort",
  "birthplace",
  "birth place",
  "geburts stadt",
  "birth city",
  "city of birth",
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
    // Try direct by ID
    const byId = new URL(`/wp-json/wc/v3/orders/${id}`, baseUrl);
    byId.searchParams.set("consumer_key", key);
    byId.searchParams.set("consumer_secret", secret);
    let r = await fetch(byId, { headers: { Accept: "application/json" } });
    if (r.ok) return await r.json();

    // Fallback: search by order number
    const list = new URL(`/wp-json/wc/v3/orders`, baseUrl);
    list.searchParams.set("consumer_key", key);
    list.searchParams.set("consumer_secret", secret);
    list.searchParams.set("per_page", "20");
    list.searchParams.set("search", String(id));
    r = await fetch(list, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const arr = (await r.json()) as any[];
    const match = (Array.isArray(arr) ? arr : []).find(
      (o: any) => String(o?.number ?? o?.id ?? "") === String(id),
    ) || (Array.isArray(arr) ? arr[0] : null);
    if (!match) return null;
    const byRealId = new URL(`/wp-json/wc/v3/orders/${match.id}`, baseUrl);
    byRealId.searchParams.set("consumer_key", key);
    byRealId.searchParams.set("consumer_secret", secret);
    const r2 = await fetch(byRealId, { headers: { Accept: "application/json" } });
    if (!r2.ok) return null;
    return await r2.json();
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

    let dob = extractFromMeta(meta, META_KEYS_DOB) || "";
    let nationality = extractFromMeta(meta, META_KEYS_NATIONALITY) || "";
    let birthPlace = extractFromMeta(meta, META_KEYS_BIRTH_PLACE) || "";

    const pickPart = (s: string) => {
      const lc = (s || "").toLowerCase();
      if (lc.includes("mündlich") || lc.includes("muendlich")) return "nur mündlich";
      if (lc.includes("schriftlich")) return "nur schriftlich";
      return "Gesamt";
    };
    const examPart = pickPart(extractFromMeta(meta, META_KEYS_EXAM_PART) || examKind);

    const now = new Date();
    const fullName = [billing?.first_name, billing?.last_name].filter(Boolean).join(" ");
    const data = {
      orderNumber: order?.number ?? String(order?.id ?? orderId),
      firstName: billing?.first_name || "",
      lastName: billing?.last_name || "",
      fullName,
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
      dob,
      nationality,
      birthPlace,
      bookingDate: order?.date_created || "",
      paymentMethod: order?.payment_method_title || order?.payment_method || "",
      today: now.toLocaleDateString("de-DE"),
      todayISO: now.toISOString().slice(0, 10),
      docDate: now.toLocaleDateString("de-DE"),
      docDateISO: now.toISOString().slice(0, 10),
    } as Record<string, any>;

    // Uppercase aliases for common template tags
    const aliasMap: Record<string, string> = {
      FIRSTNAME: "firstName",
      LASTNAME: "lastName",
      FULLNAME: "fullName",
      NAME: "fullName",
      EMAIL: "email",
      PHONE: "phone",
      ADDRESS1: "address1",
      ADDRESS2: "address2",
      CITY: "city",
      ZIP: "zip",
      COUNTRY: "country",
      ORDERNUMBER: "orderNumber",
      EXAMTYPE: "examKind",
      EXAM_KIND: "examKind",
      EXAMPART: "examPart",
      EXAM_PART: "examPart",
      EXAMDATE: "examDate",
      EXAM_DATE: "examDate",
      DOC_DATE: "docDate",
      TODAY: "today",
      DOB: "dob",
      NATIONALITY: "nationality",
      BIRTHPLACE: "birthPlace",
    };
    for (const [alias, key] of Object.entries(aliasMap)) {
      (data as any)[alias] = (data as any)[key] ?? "";
    }

    let templateBuffer: Buffer;
    if (templateUrl) {
      const tmplRes = await fetch(templateUrl);
      if (!tmplRes.ok) return res.status(400).json({ message: `Failed to download template (${tmplRes.status})` });
      const arrayBuffer = await tmplRes.arrayBuffer();
      templateBuffer = Buffer.from(arrayBuffer);
    } else {
      try {
        templateBuffer = await fs.readFile(TEMPLATE_PATH);
      } catch {
        return res.status(400).json({ message: "No template uploaded. Please upload a registration.docx template first." });
      }
    }
    const zip = new PizZip(templateBuffer);
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
      const props = e?.properties;
      if (props?.errors && Array.isArray(props.errors)) {
        const details = props.errors.map((err: any) => ({
          id: err?.properties?.id || err?.id,
          xtag: err?.properties?.xtag || err?.xtag,
          explanation: err?.properties?.explanation || err?.explanation,
          context: err?.properties?.context || err?.context,
          file: err?.properties?.file || err?.file,
        }));
        return res.status(400).json({ message: "Template error", details });
      }
      return res.status(400).json({ message: `Template render failed: ${e?.message || e}` });
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
