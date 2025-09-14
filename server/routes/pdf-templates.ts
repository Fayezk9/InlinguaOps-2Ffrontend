import type { RequestHandler } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getWooConfig } from "./woocommerce-config";
import countries from "i18n-iso-countries";

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
      'orderNumber','firstName','lastName','fullName','email','phone','address1','address2','fullAddress','fullCity','streetHouse','city','zip','country','examKind','examPart','exam','examDate','examTime','dob','nationality','birthPlace','bookingDate','paymentMethod','price','priceEUR','today','todayISO','docDate','docDateISO'
    ];
    const aliasMap: Record<string,string> = {
      FIRSTNAME:'firstName',LASTNAME:'lastName',FULLNAME:'fullName',NAME:'fullName',EMAIL:'email',PHONE:'phone',ADDRESS1:'address1',ADDRESS2:'address2',FULLADDRESS:'fullAddress',FULL_ADDRESS:'fullAddress',FULLCITY:'fullCity',FULL_CITY:'fullCity','FULL CITY':'fullCity',STREETHOUSE:'streetHouse',CITY:'city',ZIP:'zip',COUNTRY:'country',ORDERNUMBER:'orderNumber',EXAMTYPE:'examKind',EXAM_KIND:'examKind',EXAMPART:'examPart',EXAM_PART:'examPart',EXAM:'exam',EXAMDATE:'examDate',EXAM_DATE:'examDate',EXAM_TIME:'examTime',DOC_DATE:'docDate',TODAY:'today',DOB:'dob',BIRTHDAY:'dob','BIRTH DAY':'dob','GEBURTSDATUM':'dob',NATIONALITY:'nationality','NATIONALITÄT':'nationality','NATIONALITAET':'nationality',BIRTHPLACE:'birthPlace','GEBURTSORT':'birthPlace',PRICE:'price',PRICE_EUR:'priceEUR'
    };
    const allowedRaw = [...baseKeys, ...Object.keys(aliasMap)];
    const norm = (s: string) => s
      .toString()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
    const allowed = new Set<string>([
      ...allowedRaw,
      ...allowedRaw.map(s => s.toUpperCase()),
      ...allowedRaw.map(norm)
    ]);
    const unknownFields = fieldNames.filter(n => {
      const variants = [n, n.toUpperCase(), norm(n)];
      return variants.every(v => !allowed.has(v));
    });
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
const META_KEYS_BIRTH_COUNTRY = [
  'geburtsland','birth country','birthcountry','country of birth','land des geburts','land des geburt','land des geburtsortes','birth land','birth-land'
];
function formatDateDE(input: string | undefined): string {
  const s = String(input || '').trim();
  if (!s) return '';
  // If already DD.MM.YYYY, keep as is
  const m = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
  if (m) return s;
  // Try ISO or other parseable
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.toLocaleDateString('de-DE');
  }
  // Try YYYY-MM-DD or YYYY/MM/DD manually
  const m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    return d.toLocaleDateString('de-DE');
  }
  return s;
}

function extractFromMeta(meta: Record<string, any>, keys: string[]): string | undefined {
  const normalized = Object.fromEntries(Object.entries(meta).map(([k, v]) => [normalizeMetaKey(k), v]));
  for (const k of keys) {
    const nk = normalizeMetaKey(k);
    // Exact match first
    let v = normalized[nk];
    if (v != null && String(v).trim().length > 0) return String(v);
    // Fallback: allow prefixed keys like "order geburtsdatum" or "_order_geburtsland"
    for (const [mk, mv] of Object.entries(normalized)) {
      if (!mv) continue;
      if (mk === nk || mk.endsWith(" " + nk) || mk.endsWith("-" + nk) || mk.endsWith("_" + nk)) {
        const sv = String(mv).trim();
        if (sv) return sv;
      }
    }
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

const generateRequest = z.object({ orderNumbers: z.array(z.union([z.string(), z.number()])).min(1), overrides: z.record(z.any()).optional() });

export const generateRegistrationPdf: RequestHandler = async (req, res) => {
  try {
    const parsed = generateRequest.safeParse(req.body);
    try { /* locales optional */ } catch {}
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
    const deriveExamKind = (): string => {
      try {
        const items = Array.isArray(order?.line_items) ? order.line_items : [];
        const joined = items.map((li: any) => String(li?.name || '')).join(' ').toUpperCase();
        if (joined.includes('C1')) return 'telc C1 Prüfung';
        if (joined.includes('B2')) return 'telc B2 Prüfung';
        if (joined.includes('B1')) return 'telc B1 Prüfung';
      } catch {}
      return '';
    };
    const examKind = deriveExamKind() || (extractFromMeta(meta, META_KEYS_EXAM_KIND) || '');
    const pickPart = (s: string) => { const lc = (s||'').toLowerCase(); if (lc.includes('mündlich') || lc.includes('muendlich')) return 'nur mündlich'; if (lc.includes('schriftlich')) return 'nur schriftlich'; return 'Gesamt'; };
    const metaVals = Object.values(meta).map(v => String(v).toLowerCase());
    const examPartRaw = extractFromMeta(meta, META_KEYS_EXAM_PART) || metaVals.find(v => v.includes('nur mündlich') || v.includes('nur muendlich') || v.includes('nur schriftlich')) || '';
    const examPart = pickPart(examPartRaw);
    const examPartLc = (examPart || '').toLowerCase();
    const examTime = (examPartLc.includes('mündlich') || examPartLc.includes('muendlich')) ? '14:30 Uhr' : '09:00 Uhr';

    let dob = extractFromMeta(meta, META_KEYS_DOB) || '';
    if (!dob) {
      const b = order?.billing || {};
      dob = b.dob || b.birth_date || b.birthdate || b.date_of_birth || '';
    }
    dob = formatDateDE(dob);
    let nationality = extractFromMeta(meta, META_KEYS_NATIONALITY) || '';
    let birthPlace = extractFromMeta(meta, META_KEYS_BIRTH_PLACE) || '';
    const birthCountryRaw = extractFromMeta(meta, META_KEYS_BIRTH_COUNTRY) || '';
    const toAlpha3 = (s: string): string => {
      const v = (s || '').trim();
      if (!v) return '';
      const up = v.toUpperCase();
      try { if (up.length === 3 && countries.alpha3ToAlpha2(up)) return up; } catch {}
      try { if (up.length === 2) { const a3 = countries.alpha2ToAlpha3(up as any); if (a3) return a3; } } catch {}
      try { const de3 = countries.getAlpha3Code(v, 'de'); if (de3) return de3; } catch {}
      try { const en3 = countries.getAlpha3Code(v, 'en'); if (en3) return en3; } catch {}
      return '';
    };
    const nat3 = toAlpha3(birthCountryRaw || nationality);
    let nationalityCode = '';
    if (nat3) nationalityCode = nat3;
    if (!nationalityCode) {
      const bc = String(billing?.country || '').trim();
      const a3 = toAlpha3(bc);
      if (a3) nationalityCode = a3;
    }
    const toDisplayNat = (code3: string, fallbackRaw: string): string => {
      const raw = (fallbackRaw || '').trim();
      try {
        if (code3) {
          const a2 = countries.alpha3ToAlpha2(code3);
          if (a2) {
            try {
              const dn = new (Intl as any).DisplayNames(['de'], { type: 'region' });
              const name = dn?.of?.(a2);
              if (name) return name;
            } catch {}
            return a2;
          }
          return code3;
        }
      } catch {}
      const maybe = raw.toUpperCase();
      if (/^[A-Z]{2,3}$/.test(maybe)) {
        try {
          const a2 = maybe.length === 2 ? maybe : countries.alpha3ToAlpha2(maybe);
          if (a2) {
            try {
              const dn = new (Intl as any).DisplayNames(['de'], { type: 'region' });
              const name = dn?.of?.(a2);
              if (name) return name;
            } catch {}
            return a2;
          }
        } catch {}
      }
      return raw;
    };
    nationality = nationalityCode || nationality;

    const now = new Date();
    const fullName = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ');
    const priceRaw = String(order?.total ?? '');
    const priceEUR = (() => { const n = Number(priceRaw.replace(',', '.')); return isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : priceRaw || ''; })();
    const fullAddressCombined = [billing?.address_1 || '', billing?.address_2 || ''].filter(Boolean).join('\n');
    const fullCity = [billing?.postcode || '', billing?.city || ''].filter(Boolean).join(' ').trim();
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
      fullCity,
      streetHouse: (() => {
        const a = [billing?.address_1 || '', billing?.address_2 || ''].filter(Boolean).join(' ').trim();
        if (a) return a;
        const lines = String(fullAddressCombined || '').split('\n').map(s => s.trim()).filter(Boolean);
        const fc = String(fullCity || '').trim();
        return lines.filter(l => l !== fc).join(' ');
      })(),
      city: billing?.city || '',
      zip: billing?.postcode || '',
      country: billing?.country || '',
      examKind,
      examPart,
      exam: `${examKind || ''}${examPart ? ` (${examPart})` : ''}`.trim(),
      examDate,
      examTime,
      dob,
      nationality,
      nationalityCode,
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

    // Apply client overrides if provided
    const overrides = (parsed.data as any).overrides || {};
    if (overrides && typeof overrides === 'object') {
      for (const [k, v] of Object.entries(overrides)) {
        if (v != null && v !== '') data[k] = v as any;
      }
    }
    data.exam = `${data.examKind || ''}${data.examPart ? ` (${data.examPart})` : ''}`.trim();
    const deriveStreet = (addr: string, city: string) => {
      const lines = String(addr || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const fc = String(city || '').trim();
      return lines.filter(l => l !== fc).join(' ');
    };
    data.streetHouse = String(data.streetHouse || '').trim() || [data.address1, data.address2].filter(Boolean).join(' ').trim() || deriveStreet(data.fullAddress, data.fullCity);

    const tpl = await fs.readFile(TEMPLATE_PDF_PATH);
    const pdfDoc = await PDFDocument.load(tpl);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Fill fields by name (support uppercase aliases)
    const aliasMap: Record<string,string> = {
      FIRSTNAME:'firstName',LASTNAME:'lastName',FULLNAME:'fullName',NAME:'fullName',EMAIL:'email',PHONE:'phone',ADDRESS1:'address1',ADDRESS2:'address2',FULLADDRESS:'fullAddress',FULL_ADDRESS:'fullAddress',FULLCITY:'fullCity',FULL_CITY:'fullCity','FULL CITY':'fullCity',STREETHOUSE:'streetHouse',CITY:'city',ZIP:'zip',COUNTRY:'country',ORDERNUMBER:'orderNumber',EXAMTYPE:'examKind',EXAM_KIND:'examKind',EXAMPART:'examPart',EXAM_PART:'examPart',EXAM:'exam',EXAMDATE:'examDate',EXAM_DATE:'examDate',EXAM_TIME:'examTime',DOC_DATE:'docDate',TODAY:'today',DOB:'dob',BIRTHDAY:'dob','BIRTH DAY':'dob','GEBURTSDATUM':'dob',NATIONALITY:'nationality','NATIONALITÄT':'nationality','NATIONALITAET':'nationality',BIRTHPLACE:'birthPlace','GEBURTSORT':'birthPlace',PRICE:'price',PRICE_EUR:'priceEUR'
    };
    const norm = (s: string) => s
      .toString()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
    const aliasNorm: Record<string,string> = Object.fromEntries(Object.entries(aliasMap).map(([k,v]) => [norm(k), v]));
    const nameNormToData: Record<string,string> = Object.fromEntries(Object.keys(data).map(k => [norm(k), k]));
    for (const f of fields) {
      const raw = f.getName();
      const up = raw.toUpperCase();
      const key = aliasMap[up] || aliasNorm[norm(raw)] || nameNormToData[norm(raw)] || raw;
      const val = data[key];
      if (val == null) continue;
      try {
        // @ts-ignore
        if (typeof f.setText === 'function') {
          // @ts-ignore
          f.setText(String(val));
        // @ts-ignore
        } else if (typeof f.select === 'function') {
          // @ts-ignore
          f.select(String(val));
        // @ts-ignore
        } else if (typeof f.check === 'function' && (val === true || String(val).toLowerCase() === 'true')) {
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
