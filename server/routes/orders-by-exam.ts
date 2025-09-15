import { z } from "zod";
import type { RequestHandler } from "express";
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
    if (normalized[nk] != null && String(normalized[nk]).length > 0)
      return String(normalized[nk]);
  }
  return undefined;
}

const META_KEYS_EXAM_DATE = [
  "exam_date","pruefungsdatum","prüfungsdatum","prüfungstermin","termin","prüfungstermin wählen","prüfungstermin wählen:","prüfungs termin wählen","choose exam date","choose exam date:"
];

const META_KEYS_CERTIFICATE = [
  "zertifikat","certificate","certificate_delivery","zertifikat_versand","zertifikat versand","lieferung_zertifikat","zertifikat_abholung"
];

const META_KEYS_LEVEL = [
  "pruefungsniveau","prüfungsniveau","exam_level","level","niveau","language_level","pruefung_level","prüfung_level"
];

function normalizeLevelValue(s: string): string {
  const m = String(s || "").toUpperCase().match(/\b(B1|B2|C1)\b/);
  return m ? m[1] : "";
}

function detectLevel(meta: Record<string, any>, order: any): string {
  const metaLevel = normalizeLevelValue(extractFromMeta(meta, META_KEYS_LEVEL) || "");
  if (metaLevel) return metaLevel;
  const items = Array.isArray(order?.line_items) ? order.line_items : [];
  for (const li of items) {
    const found = normalizeLevelValue([li?.name, li?.sku, li?.description].filter(Boolean).join(" "));
    if (found) return found;
  }
  return "";
}

async function fetchAllOrderIds(baseUrl: string, key: string, secret: string): Promise<number[]> {
  const perPage = 100;
  const makeUrl = (page: number) => {
    const url = new URL("/wp-json/wc/v3/orders", baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("page", String(page));
    return url;
  };
  const firstRes = await fetch(makeUrl(1), { headers: { Accept: "application/json" } });
  if (!firstRes.ok) throw new Error(`WooCommerce API error: ${firstRes.status}`);
  const firstList = await firstRes.json();
  const ids: number[] = (Array.isArray(firstList) ? firstList : []).map((o: any) => Number(o?.id)).filter(Boolean);
  const totalPagesStr = firstRes.headers.get("x-wp-totalpages") || firstRes.headers.get("X-WP-TotalPages");
  const totalPages = Math.max(1, Number(totalPagesStr) || 1);
  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page++) {
      const r = await fetch(makeUrl(page), { headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      const list = await r.json();
      ids.push(...((Array.isArray(list) ? list : []).map((o: any) => Number(o?.id)).filter(Boolean)));
    }
  }
  return Array.from(new Set(ids));
}

async function fetchOrderRaw(baseUrl: string, key: string, secret: string, id: number): Promise<any | null> {
  try {
    const url = new URL(`/wp-json/wc/v3/orders/${id}`, baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export const filterOrdersByExamHandler: RequestHandler = async (req, res) => {
  const wooConfig = getWooConfig();
  if (!wooConfig) return res.status(400).json({ message: "WooCommerce not configured" });
  const schema = z.object({ kind: z.string().min(1), date: z.string().min(1) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.flatten() });
  const { kind, date } = parsed.data;
  const { baseUrl, consumerKey, consumerSecret } = wooConfig;

  const normDate = (s: string): string => {
    const str = String(s || '').trim();
    const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) { const dd = m[1].padStart(2,'0'); const mm = m[2].padStart(2,'0'); const yyyy = m[3]; return `${dd}.${mm}.${yyyy}`; }
    const m2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) { const yyyy = m2[1]; const mm = m2[2].padStart(2,'0'); const dd = m2[3].padStart(2,'0'); return `${dd}.${mm}.${yyyy}`; }
    const t = Date.parse(str);
    if (!Number.isNaN(t)) { const d = new Date(t); const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = String(d.getFullYear()); return `${dd}.${mm}.${yyyy}`; }
    return str;
  };

  try {
    const ids = await fetchAllOrderIds(baseUrl, consumerKey, consumerSecret);
    const detailed = await Promise.all(ids.map((id) => fetchOrderRaw(baseUrl, consumerKey, consumerSecret, id)));
    const wantedDate = normDate(date);
    const rows = (detailed || []).filter(Boolean).map((order: any) => {
      const meta: Record<string, any> = {};
      const coerceVal = (v: any): string => {
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        if (Array.isArray(v)) return v.map(coerceVal).filter(Boolean).join(', ');
        if (typeof v === 'object') { if ((v as any).label) return String((v as any).label); if ((v as any).value) return coerceVal((v as any).value); try { return JSON.stringify(v); } catch { return String(v); } }
        return String(v);
      };
      const addMeta = (arr: any[]) => { if (!Array.isArray(arr)) return; for (const m of arr) { const rawK = (m?.key ?? m?.name ?? m?.display_key ?? '').toString(); const k = normalizeMetaKey(rawK); const valRaw = m?.value ?? m?.display_value ?? m?.option ?? ''; const v = coerceVal(valRaw); if (k) meta[k] = v; const displayKey = m?.display_key ? normalizeMetaKey(String(m.display_key)) : ''; if (displayKey) meta[displayKey] = v; if (valRaw && typeof valRaw === 'object' && (valRaw as any).label) { const lk = normalizeMetaKey(String((valRaw as any).label)); const lv = coerceVal((valRaw as any).value ?? (valRaw as any).display_value ?? ''); if (lk) meta[lk] = lv; } } };
      addMeta(order?.meta_data || []);
      (order?.line_items || []).forEach((li: any) => addMeta(li?.meta_data || []));
      const billing = order?.billing || {};
      const detectedKind = detectLevel(meta, order);
      const dateRaw = extractFromMeta(meta, META_KEYS_EXAM_DATE) || '';
      const examDate = normDate(dateRaw);
      const cert = extractFromMeta(meta, META_KEYS_CERTIFICATE) || '';
      return {
        orderNumber: order?.number ?? String(order?.id || ''),
        lastName: billing?.last_name || '',
        firstName: billing?.first_name || '',
        examType: detectedKind || '',
        examDate,
        certificate: cert,
      };
    }).filter(r => r.examType === kind && r.examDate === wantedDate && /post/i.test(String(r.certificate||'')));

    res.json({ results: rows });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Failed to fetch orders' });
  }
};

export default filterOrdersByExamHandler;
