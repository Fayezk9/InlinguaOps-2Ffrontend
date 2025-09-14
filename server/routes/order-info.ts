import type { RequestHandler } from "express";
import { z } from "zod";
import countries from "i18n-iso-countries";
import { getWooConfig } from "./woocommerce-config";

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

function extractFromMeta(meta: Record<string, any>, keys: string[]): string | undefined {
  const normalized = Object.fromEntries(Object.entries(meta).map(([k, v]) => [normalizeMetaKey(k), v]));
  for (const k of keys) {
    const nk = normalizeMetaKey(k);
    let v = normalized[nk];
    if (v != null && String(v).trim().length > 0) return String(v);
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

const META_KEYS_EXAM_DATE = ['exam_date','pruefungsdatum','prüfungsdatum','prüfungstermin','termin','prüfungstermin wählen','prüfungstermin wählen:','prüfungs termin wählen','choose exam date','choose exam date:'];
const META_KEYS_EXAM_KIND = ['pruefungstyp','prüfungstyp','exam_type','exam_kind','type','typ','teilnahmeart','pruefung_art','prüfungsart','pruefungsart','level'];
const META_KEYS_EXAM_PART = ['prüfungsteil','pruefungsteil','exam_part','exam part','teilnahmeart','teilnahme'];
const META_KEYS_DOB = ['dob','date_of_birth','geburtsdatum','geburtstag','birth_date','billing_dob','billing_birthdate','_billing_birthdate','birthday'];
const META_KEYS_BIRTH_PLACE = ['geburtsort','birthplace','birth place','geburts stadt','birth city','city of birth'];
const META_KEYS_BIRTH_COUNTRY = ['geburtsland','birth country','birthcountry','country of birth','land des geburts','land des geburt','land des geburtsortes','birth land','birth-land'];

const requestSchema = z.object({ orderNumbers: z.array(z.union([z.string(), z.number()])).min(1) });

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

function formatDateDE(input: string | undefined): string {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
  if (m) return s;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return d.toLocaleDateString('de-DE');
  }
  const m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    return d.toLocaleDateString('de-DE');
  }
  return s;
}

export const getRegistrationOrderInfo: RequestHandler = async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    try { /* locales optional */ } catch {}
    if (!parsed.success) return res.status(400).json({ message: 'Invalid request' });
    const orderId = parsed.data.orderNumbers[0];

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

    let dob = extractFromMeta(meta, META_KEYS_DOB) || '';
    if (!dob) {
      dob = billing.dob || billing.birth_date || billing.birthdate || billing.date_of_birth || '';
    }
    dob = formatDateDE(dob);

    const birthPlace = extractFromMeta(meta, META_KEYS_BIRTH_PLACE) || '';
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

    let nationalityCode = '';
    const nat3 = toAlpha3(birthCountryRaw);
    if (nat3) nationalityCode = nat3;
    if (!nationalityCode) {
      const bc = String(billing?.country || '').trim();
      const a3 = toAlpha3(bc);
      if (a3) nationalityCode = a3;
    }
    const toDisplayCountry = (code3: string, fallbackRaw: string): string => {
      const raw = (fallbackRaw || '').trim();
      if (code3) return code3;
      return raw;
    };
    const birthLand = toDisplayCountry(nationalityCode, birthCountryRaw);

    const fullAddressCombined = [billing?.address_1 || '', billing?.address_2 || ''].filter(Boolean).join('\n');
    const priceRaw = String(order?.total ?? '');
    const priceEUR = (() => { const n = Number(priceRaw.replace(',', '.')); return isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : priceRaw || ''; })();

    const data = {
      orderNumber: order?.number ?? String(order?.id ?? orderId),
      lastName: billing?.last_name || '',
      firstName: billing?.first_name || '',
      dob,
      fullAddress: fullAddressCombined,
      email: billing?.email || '',
      birthPlace,
      birthLand,
      examKind,
      examPart,
      price: priceRaw,
      priceEUR,
    };

    return res.json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Failed to fetch order info' });
  }
};
