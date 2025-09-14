import type { RequestHandler } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getWooConfig } from "./woocommerce-config";

const TEMPLATE_DIR = "data/docs/templates";
const TEMPLATE_PDF_PATH = path.join(TEMPLATE_DIR, "registration.pdf");

const uploadSchema = z.object({
  contentBase64: z.string().min(1),
  filename: z.string().optional(),
});

export const uploadRegistrationPdfTemplate: RequestHandler = async (req, res) => {
  try {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid upload payload" });
    const { contentBase64 } = parsed.data;
    const idx = contentBase64.indexOf(',');
    const b64 = idx >= 0 ? contentBase64.slice(idx + 1) : contentBase64;
    let buf: Buffer;
    try { buf = Buffer.from(b64, 'base64'); } catch { return res.status(400).json({ message: 'Invalid base64 content' }); }
    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    await fs.writeFile(TEMPLATE_PDF_PATH, buf);
    return res.json({ message: 'PDF template uploaded', path: TEMPLATE_PDF_PATH });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Failed to upload PDF template' });
  }
};

export const getRegistrationPdfTemplateStatus: RequestHandler = async (_req, res) => {
  try {
    const stat = await fs.stat(TEMPLATE_PDF_PATH).catch(() => null);
    if (!stat) return res.json({ exists: false });
    return res.json({ exists: true, size: stat.size, mtime: stat.mtimeMs, path: TEMPLATE_PDF_PATH });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Failed to get PDF template status' });
  }
};

export const validateRegistrationPdfTemplate: RequestHandler = async (_req, res) => {
  try {
    const stat = await fs.stat(TEMPLATE_PDF_PATH).catch(() => null);
    if (!stat) return res.status(400).json({ message: 'No PDF template uploaded' });
    const buf = await fs.readFile(TEMPLATE_PDF_PATH);
    const pdf = await PDFDocument.load(buf);
    const form = pdf.getForm();
    const fields = form.getFields();
    const fieldNames = fields.map(f => f.getName());

    const baseKeys = [
      'orderNumber','firstName','lastName','fullName','email','phone','address1','address2','fullAddress','city','zip','country','examKind','examPart','examDate','examTime','dob','nationality','birthPlace','bookingDate','paymentMethod','price','priceEUR','today','todayISO','docDate','docDateISO'
    ];
    const aliasMap: Record<string,string> = {
      FIRSTNAME:'firstName',LASTNAME:'lastName',FULLNAME:'fullName',NAME:'fullName',EMAIL:'email',PHONE:'phone',ADDRESS1:'address1',ADDRESS2:'address2',FULLADDRESS:'fullAddress',FULL_ADDRESS:'fullAddress',CITY:'city',ZIP:'zip',COUNTRY:'country',ORDERNUMBER:'orderNumber',EXAMTYPE:'examKind',EXAM_KIND:'examKind',EXAMPART:'examPart',EXAM_PART:'examPart',EXAMDATE:'examDate',EXAM_DATE:'examDate',EXAM_TIME:'examTime',DOC_DATE:'docDate',TODAY:'today',DOB:'dob',BIRTHDAY:'dob',NATIONALITY:'nationality',BIRTHPLACE:'birthPlace',PRICE:'price',PRICE_EUR:'priceEUR'
    };
    const allowed = new Set([...baseKeys, ...Object.keys(aliasMap)]);
    const unknownFields = fieldNames.filter(n => !allowed.has(n) && !allowed.has(n.toUpperCase()));
    const ok = unknownFields.length === 0 && fieldNames.length > 0;
    return res.json({ ok, fields: fieldNames, unknownFields });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Failed to validate PDF template' });
  }
};

// Woo data helpers (light copy)
function normalizeMetaKey(key: string): string {
  const s = key.toString().trim().replace(/:$/u, "");
  const lower = s.toLowerCase();
  return lower
    .replace(/\(.*?\)/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const META_KEYS_EXAM_DATE = [
  'exam_date','pruefungsdatum','prüfungsdatum','prüfungstermin','termin','prüfungstermin wählen','prüfungstermin wählen:','prüfungs termin wählen','choose exam date','choose exam date:'
];
const META_KEYS_EXAM_KIND = [
  'pruefungstyp','prüfungstyp','exam_type','exam_kind','type','typ','teilnahmeart','pruefung_art','prüfungsart','pruefungsart','level'
];
const META_KEYS_EXAM_PART = [
  'prüfungsteil','pruefungsteil','exam_part','exam part','teilnahmeart','teilnahme'
];
const META_KEYS_DOB = [
  'dob','date_of_birth','geburtsdatum','geburtstag','birth_date','billing_dob','billing_birthdate','_billing_birthdate','birthday'
];
const META_KEYS_NATIONALITY = [
  'nationalitaet','nationalität','staatsangehoerigkeit','staatsangehörigkeit','nationality'
];
const META_KEYS_BIRTH_PLACE = [
  'geburtsort','birthplace','birth place','geburts stadt','birth city','city of birth'
];
function extractFromMeta(meta: Record<string, any>, keys: string[]): string | undefined {
  const normalized = Object.fromEntries(Object.entries(meta).map(([k, v]) => [normalizeMetaKey(k), v]));
  for (const k of keys) {
    const nk = normalizeMetaKey(k);
    const v = normalized[nk];
    if (v != null && String(v).trim().length > 0) return String(v);
  }
  return undefined;
}

async function fetchOrderRaw(baseUrl: string, key: string, secret: string, id: string | number) {
  try {
    const byId = new URL(`/wp-json/wc/v3/orders/${id}`, baseUrl);
    byId.searchParams.set('consumer_key', key);
    byId.searchParams.set('consumer_secret', secret);
    let r = await fetch(byId, { headers: { Accept: 'application/json' } });
    if (r.ok) return await r.json();
    const list = new URL(`/wp-json/wc/v3/orders`, baseUrl);
    list.searchParams.set('consumer_key', key);
    list.searchParams.set('consumer_secret', secret);
    list.searchParams.set('per_page', '20');
    list.searchParams.set('search', String(id));
    r = await fetch(list, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const arr = (await r.json()) as any[];
    const match = (Array.isArray(arr) ? arr : []).find((o: any) => String(o?.number ?? o?.id ?? '') === String(id)) || (Array.isArray(arr) ? arr[0] : null);
    if (!match) return null;
    const byRealId = new URL(`/wp-json/wc/v3/orders/${match.id}`, baseUrl);
    byRealId.searchParams.set('consumer_key', key);
    byRealId.searchParams.set('consumer_secret', secret);
    const r2 = await fetch(byRealId, { headers: { Accept: 'application/json' } });
    if (!r2.ok) return null;
    return await r2.json();
  } catch { return null; }
}

const generateRequest = z.object({ orderNumbers: z.array(z.union([z.string(), z.number()])).min(1) });

export const generateRegistrationPdf: RequestHandler = async (req, res) => {
  try {
    const parsed = generateRequest.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid request' });
    const orderId = parsed.data.orderNumbers[0];

    const pdfStat = await fs.stat(TEMPLATE_PDF_PATH).catch(() => null);
    if (!pdfStat) return res.status(400).json({ message: 'No PDF template uploaded' });

    const wooConfig = getWooConfig();
    if (!wooConfig) return res.status(400).json({ message: 'WooCommerce not configured. Please configure WooCommerce.' });

    const { baseUrl, consumerKey, consumerSecret } = wooConfig;
    const order = await fetchOrderRaw(baseUrl, consumerKey, consumerSecret, orderId);
    if (!order) return res.status(404).json({ message: `Order ${orderId} not found` });

    const meta: Record<string, any> = {};
    const coerceVal = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (Array.isArray(v)) return v.map(coerceVal).filter(Boolean).join(', ');
      if (typeof v === 'object') { if ((v as any).label) return String((v as any).label); if ((v as any).value) return coerceVal((v as any).value); try { return JSON.stringify(v); } catch { return String(v); } }
      return String(v);
    };
    const addMeta = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      for (const m of arr) {
        const rawK = (m?.key ?? m?.name ?? m?.display_key ?? '').toString();
        const k = normalizeMetaKey(rawK);
        const valRaw = m?.value ?? m?.display_value ?? m?.option ?? '';
        const v = coerceVal(valRaw);
        if (k) meta[k] = v;
        const displayKey = m?.display_key ? normalizeMetaKey(String(m.display_key)) : '';
        if (displayKey) meta[displayKey] = v;
        if (valRaw && typeof valRaw === 'object' && (valRaw as any).label) {
          const lk = normalizeMetaKey(String((valRaw as any).label));
          const lv = coerceVal((valRaw as any).value ?? (valRaw as any).display_value ?? '');
          if (lk) meta[lk] = lv;
        }
      }
    };
    addMeta(order?.meta_data || []);
    (order?.line_items || []).forEach((li: any) => addMeta(li?.meta_data || []));

    const billing = order?.billing || {};
    const examDate = extractFromMeta(meta, META_KEYS_EXAM_DATE) || '';
    const examKind = extractFromMeta(meta, META_KEYS_EXAM_KIND) || '';
    const pickPart = (s: string) => { const lc = (s||'').toLowerCase(); if (lc.includes('mündlich') || lc.includes('muendlich')) return 'nur mündlich'; if (lc.includes('schriftlich')) return 'nur schriftlich'; return 'Gesamt'; };
    const examPart = pickPart(extractFromMeta(meta, META_KEYS_EXAM_PART) || examKind);
    const examPartLc = (examPart || '').toLowerCase();
    const examTime = (examPartLc.includes('mündlich') || examPartLc.includes('muendlich')) ? '14:30 Uhr' : '09:00 Uhr';

    let dob = extractFromMeta(meta, META_KEYS_DOB) || '';
    let nationality = extractFromMeta(meta, META_KEYS_NATIONALITY) || '';
    let birthPlace = extractFromMeta(meta, META_KEYS_BIRTH_PLACE) || '';

    const now = new Date();
    const fullName = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ');
    const priceRaw = String(order?.total ?? '');
    const priceEUR = (() => { const n = Number(priceRaw.replace(',', '.')); return isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : priceRaw || ''; })();
    const fullAddressCombined = [billing?.address_1 || '', billing?.address_2 || ''].filter(Boolean).join('\n');
    const data: Record<string, any> = {
      orderNumber: order?.number ?? String(order?.id ?? orderId),
      firstName: billing?.first_name || '',
      lastName: billing?.last_name || '',
      fullName,
      email: billing?.email || '',
      phone: billing?.phone || '',
      address1: billing?.address_1 || '',
      address2: billing?.address_2 || '',
      fullAddress: fullAddressCombined,
      city: billing?.city || '',
      zip: billing?.postcode || '',
      country: billing?.country || '',
      examKind,
      examPart,
      examDate,
      examTime,
      dob,
      nationality,
      birthPlace,
      bookingDate: order?.date_created || '',
      paymentMethod: order?.payment_method_title || order?.payment_method || '',
      price: priceRaw,
      priceEUR,
      today: now.toLocaleDateString('de-DE'),
      todayISO: now.toISOString().slice(0, 10),
      docDate: now.toLocaleDateString('de-DE'),
      docDateISO: now.toISOString().slice(0, 10),
    };

    const tpl = await fs.readFile(TEMPLATE_PDF_PATH);
    const pdfDoc = await PDFDocument.load(tpl);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Fill fields by name (support uppercase aliases)
    const aliasMap: Record<string,string> = {
      FIRSTNAME:'firstName',LASTNAME:'lastName',FULLNAME:'fullName',NAME:'fullName',EMAIL:'email',PHONE:'phone',ADDRESS1:'address1',ADDRESS2:'address2',FULLADDRESS:'fullAddress',FULL_ADDRESS:'fullAddress',CITY:'city',ZIP:'zip',COUNTRY:'country',ORDERNUMBER:'orderNumber',EXAMTYPE:'examKind',EXAM_KIND:'examKind',EXAMPART:'examPart',EXAM_PART:'examPart',EXAMDATE:'examDate',EXAM_DATE:'examDate',EXAM_TIME:'examTime',DOC_DATE:'docDate',TODAY:'today',DOB:'dob',BIRTHDAY:'dob',NATIONALITY:'nationality',BIRTHPLACE:'birthPlace',PRICE:'price',PRICE_EUR:'priceEUR'
    };
    for (const f of fields) {
      const raw = f.getName();
      const key = aliasMap[raw.toUpperCase()] || raw;
      const val = data[key];
      if (val == null) continue;
      try {
        // @ts-ignore
        if (f.setText) {
          // @ts-ignore
          f.setText(String(val));
        // @ts-ignore
        } else if (f.check && (val === true || String(val).toLowerCase() === 'true')) {
          // @ts-ignore
          f.check();
        }
      } catch {}
    }
    // Optional: embed font for non-ASCII rendering
    try {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(font);
    } catch {}
    form.flatten();
    const out = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="registration-${data.orderNumber}.pdf"`);
    return res.send(Buffer.from(out));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Failed to generate PDF' });
  }
};
