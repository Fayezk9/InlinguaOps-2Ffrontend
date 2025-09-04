import { RequestHandler } from "express";
import { z } from "zod";
import type {
  FetchOrdersRequest,
  FetchOrdersResponse,
  OrderFetchResult,
  WooOrder,
} from "@shared/api";
import { getWooConfig } from "./woocommerce-config";

const requestSchema = z.object({
  orderIds: z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .max(500),
});

async function fetchOrder(
  baseUrl: string,
  key: string,
  secret: string,
  id: string | number,
): Promise<OrderFetchResult> {
  const url = new URL(`/wp-json/wc/v3/orders/${id}`, baseUrl);
  url.searchParams.set("consumer_key", key);
  url.searchParams.set("consumer_secret", secret);

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { ok: false, id: String(id), error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as WooOrder;

    return {
      ok: true,
      id: String(id),
      order: {
        id: data.id,
        number: data.number ?? String(data.id),
        status: data.status,
        total: data.total,
        currency: data.currency,
        createdAt: data.date_created,
        customerName: [data.billing?.first_name, data.billing?.last_name]
          .filter(Boolean)
          .join(" "),
        email: data.billing?.email ?? "",
        phone: data.billing?.phone ?? "",
        paymentMethod: data.payment_method_title ?? data.payment_method ?? "",
        link: `${new URL("/wp-admin/post.php", baseUrl).toString()}?post=${data.id}&action=edit`,
      },
    };
  } catch (e: any) {
    return { ok: false, id: String(id), error: e?.message ?? "Unknown error" };
  }
}

async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const current = i++;
      results[current] = await worker(items[current]);
    }
  };
  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}

export const fetchRecentOrdersHandler: RequestHandler = async (req, res) => {
  const wooConfig = getWooConfig();
  if (!wooConfig) {
    return res.status(400).json({
      message:
        "WooCommerce not configured. Please configure WooCommerce settings in Settings > WooCommerce.",
    });
  }

  const { since } = req.body;
  const sinceDate = since
    ? new Date(since)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const {
    baseUrl: WC_BASE_URL,
    consumerKey: WC_CONSUMER_KEY,
    consumerSecret: WC_CONSUMER_SECRET,
  } = wooConfig;

  try {
    const url = new URL("/wp-json/wc/v3/orders", WC_BASE_URL);
    url.searchParams.set("consumer_key", WC_CONSUMER_KEY);
    url.searchParams.set("consumer_secret", WC_CONSUMER_SECRET);
    url.searchParams.set("after", sinceDate.toISOString());
    url.searchParams.set("per_page", "100");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const orders = await response.json();
    const count = Array.isArray(orders) ? orders.length : 0;

    res.json({ count, since: sinceDate.toISOString() });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to fetch recent orders",
      error: error.message,
    });
  }
};

function normalizeMetaKey(key: string): string {
  const s = key.toString().trim().replace(/:$/u, "");
  const lower = s.toLowerCase();
  // Basic German diacritics handling and common variants
  return lower
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ");
}

function extractFromMeta(meta: Record<string, any>, keys: string[]): string | undefined {
  const normalized = Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [normalizeMetaKey(k), v]),
  );
  for (const k of keys) {
    const nk = normalizeMetaKey(k);
    if (normalized[nk] != null && String(normalized[nk]).length > 0) return String(normalized[nk]);
  }
  return undefined;
}

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
  "nationality",
  "billing_nationality",
  "staatsangehoerigkeit",
  "staatsangehörigkeit",
  "nationalitaet",
  "nationalität",
  "nationalitaet",
  "citizenship",
  "birth_country",
  "geburtsland",
  "country_of_birth",
  "geburts land",
];

const META_KEYS_BIRTH_PLACE = [
  "geburtsort",
  "ort der geburt",
  "geburts stadt",
  "birthplace",
  "place_of_birth",
  "birth_place",
  "billing_birthplace",
  "_billing_birthplace",
  "city_of_birth",
  "birth_city",
  "geburtsstadt",
];

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
  "prüfungsart",
  "pruefungsart",
  "pruefungsart",
  "art_der_pruefung",
  "art der prüfung",
  "prüfung_typ",
  "prüfung typ",
  "exam_variant",
  "variant",
  "variante",
  "prüfungsart wählen",
  "prüfungsart wählen:",
  "pruefungsart_waehlen",
  "pruefungsart waehlen",
  "exam_selection",
  "prüfung_auswahl",
  "exam_option",
];

const META_KEYS_LEVEL = [
  "pruefungsniveau",
  "prüfungsniveau",
  "exam_level",
  "level",
  "niveau",
  "language_level",
  "pruefung_level",
  "prüfung_level",
];

const HOUSE_NO_KEYS = [
  "house_number",
  "hausnummer",
  "hnr",
  "hausnr",
  "billing_house_number",
  "shipping_house_number",
  "billing_housenumber",
  "shipping_housenumber",
];

const META_KEYS_CERTIFICATE = [
  "zertifikat",
  "certificate",
  "certificate_delivery",
  "zertifikat_versand",
  "zertifikat versand",
  "lieferung_zertifikat",
  "zertifikat_abholung",
];

async function fetchOrderRaw(
  baseUrl: string,
  key: string,
  secret: string,
  id: number,
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

export const searchOrdersHandler: RequestHandler = async (req, res) => {
  const wooConfig = getWooConfig();
  if (!wooConfig) {
    return res.status(400).json({
      message:
        "WooCommerce not configured. Please configure WooCommerce settings in Settings > WooCommerce.",
    });
  }

  const { searchCriteria } = req.body;
  const {
    baseUrl: WC_BASE_URL,
    consumerKey: WC_CONSUMER_KEY,
    consumerSecret: WC_CONSUMER_SECRET,
  } = wooConfig;

  try {
    // Search WooCommerce for orders only
    const url = new URL("/wp-json/wc/v3/orders", WC_BASE_URL);
    url.searchParams.set("consumer_key", WC_CONSUMER_KEY);
    url.searchParams.set("consumer_secret", WC_CONSUMER_SECRET);
    url.searchParams.set("per_page", "100");

    if (searchCriteria.orderNumber) {
      url.searchParams.set("search", searchCriteria.orderNumber);
    }

    const wooResponse = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!wooResponse.ok) {
      throw new Error(`WooCommerce API error: ${wooResponse.status}`);
    }

    const wooOrders = await wooResponse.json();
    const ids = (Array.isArray(wooOrders) ? wooOrders : []).map((o: any) => Number(o?.id)).filter(Boolean);
    const detailed = await withConcurrency(ids, 5, (id) => fetchOrderRaw(WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET, id));

    const results = detailed.map((order: any) => {
      const meta: Record<string, any> = {};
      const coerceVal = (v: any): string => {
        if (v == null) return "";
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (Array.isArray(v)) return v.map(coerceVal).filter(Boolean).join(", ");
        if (typeof v === "object") {
          if (v.label) return String(v.label);
          if (v.value) return coerceVal(v.value);
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
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

      const dob = extractFromMeta(meta, META_KEYS_DOB);
      const nationality = extractFromMeta(meta, META_KEYS_NATIONALITY);
      const examDate = extractFromMeta(meta, META_KEYS_EXAM_DATE);
      const examKind = extractFromMeta(meta, META_KEYS_EXAM_KIND);
      const level = extractFromMeta(meta, META_KEYS_LEVEL);
      let houseNo = extractFromMeta(meta, HOUSE_NO_KEYS);
      const certificate = extractFromMeta(meta, META_KEYS_CERTIFICATE);
      const birthPlace = extractFromMeta(meta, META_KEYS_BIRTH_PLACE);

      const billing = order.billing || {};
      const shipping = order.shipping || {};
      const billingAddress1 = billing.address_1 || "";
      const billingAddress2 = billing.address_2 || "";
      if (!houseNo) {
        const extractFrom = (s?: string) => {
          if (!s) return "";
          const matches = Array.from(String(s).matchAll(/\b(\d+[a-zA-Z]?)\b/g));
          return matches.length ? matches[matches.length - 1][1] : "";
        };
        const hn = extractFrom(billingAddress1) || extractFrom(billingAddress2);
        if (hn) houseNo = hn;
      }
      const billingPostcode = billing.postcode || "";
      const billingCity = billing.city || "";
      const billingCountry = billing.country || "";

      return {
        wooOrder: {
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          currency: order.currency,
          customerName: [billing?.first_name, billing?.last_name].filter(Boolean).join(" "),
          email: billing?.email,
          phone: billing?.phone,
          billingFirstName: billing?.first_name,
          billingLastName: billing?.last_name,
          billingAddress1,
          billingAddress2,
          billingPostcode,
          billingCity,
          billingCountry,
          shippingAddress1: shipping.address_1 || "",
          shippingAddress2: shipping.address_2 || "",
          shippingPostcode: shipping.postcode || "",
          shippingCity: shipping.city || "",
          shippingCountry: shipping.country || "",
          meta,
          extracted: {
            dob,
            nationality,
            birthPlace,
            examDate,
            examKind,
            level,
            houseNo,
            certificate,
          },
        },
        participantData: null,
      };
    });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to search orders",
      error: error.message,
    });
  }
};

export const fetchOrdersHandler: RequestHandler = async (req, res) => {
  const wooConfig = getWooConfig();
  if (!wooConfig) {
    return res.status(400).json({
      message:
        "WooCommerce not configured. Please configure WooCommerce settings in Settings > WooCommerce.",
    });
  }

  const parsed = requestSchema.safeParse(req.body as FetchOrdersRequest);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid request", issues: parsed.error.flatten() });
  }

  const { orderIds } = parsed.data;
  const ids = orderIds
    .map((x) => (typeof x === "number" ? x : x.trim()))
    .filter((x) => String(x).length > 0);

  const {
    baseUrl: WC_BASE_URL,
    consumerKey: WC_CONSUMER_KEY,
    consumerSecret: WC_CONSUMER_SECRET,
  } = wooConfig;

  const results = await withConcurrency(ids, 6, (id) =>
    fetchOrder(WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET, id),
  );

  // Persist successful orders to local DB
  try {
    const { upsertOrder } = await import("../db/sqlite");
    for (const r of results) {
      if (r.ok) {
        const o = r.order;
        upsertOrder({
          id: o.id,
          number: o.number,
          status: o.status,
          total: o.total,
          currency: o.currency,
          created_at: o.createdAt,
          customer_name: o.customerName,
          email: o.email ?? null,
          phone: o.phone ?? null,
          payment_method: o.paymentMethod ?? null,
          link: o.link ?? null,
        });
      }
    }
  } catch {}

  const response: FetchOrdersResponse = {
    results,
    okCount: results.filter((r) => r.ok).length,
    errorCount: results.filter((r) => !r.ok).length,
  };
  res.json(response);
};
