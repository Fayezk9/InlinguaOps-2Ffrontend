import { RequestHandler } from "express";
import { z } from "zod";
import {
  getSetting,
  setSetting,
  saveWooConfig,
  upsertOrder,
  addExamIfNotExists,
} from "../db/sqlite";
import type { WooOrder } from "@shared/api";

export const getSetupStatus: RequestHandler = async (_req, res) => {
  const setup = getSetting("setup_completed");
  res.json({ needsSetup: setup !== "true" });
};

const initSchema = z.object({
  baseUrl: z.string().url(),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
});

async function fetchWooOrdersPaged(
  baseUrl: string,
  key: string,
  secret: string,
) {
  let page = 1;
  const perPage = 100;
  let total = 0;
  for (;;) {
    const url = new URL("/wp-json/wc/v3/orders", baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "asc");

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`WooCommerce API error: ${res.status}`);
    const arr = (await res.json()) as WooOrder[];
    if (!Array.isArray(arr) || arr.length === 0) break;

    for (const o of arr) {
      const link = `${new URL("/wp-admin/post.php", baseUrl).toString()}?post=${o.id}&action=edit`;
      upsertOrder({
        id: o.id,
        number: o.number ?? String(o.id),
        status: o.status,
        total: o.total,
        currency: o.currency,
        created_at: o.date_created,
        customer_name: [o.billing?.first_name, o.billing?.last_name]
          .filter(Boolean)
          .join(" "),
        email: o.billing?.email ?? null,
        phone: o.billing?.phone ?? null,
        payment_method: o.payment_method_title ?? o.payment_method ?? null,
        link,
      });
      total++;
    }

    if (arr.length < perPage) break;
    page++;
  }
  return total;
}

function detectKind(text: string): "B1" | "B2" | "C1" | null {
  const upper = text.toUpperCase();
  return (
    upper.includes("B1")
      ? "B1"
      : upper.includes("B2")
        ? "B2"
        : upper.includes("C1")
          ? "C1"
          : null
  ) as "B1" | "B2" | "C1" | null;
}

function parseExamFromText(
  text: string,
): { kind: "B1" | "B2" | "C1"; date: string } | null {
  const upper = text.toUpperCase();
  const kind = detectKind(upper);
  if (!kind) return null;
  // Try to find a date in multiple common formats
  const patterns = [
    /(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/, // YYYY-MM-DD or with / .
    /(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})/, // DD-MM-YYYY
  ];
  for (const re of patterns) {
    const m = upper.match(re);
    if (m) {
      let y: string, mo: string, d: string;
      if (m.length === 4) {
        // YYYY MM DD
        y = m[1];
        mo = String(m[2]).padStart(2, "0");
        d = String(m[3]).padStart(2, "0");
      } else {
        // DD MM YYYY
        d = String(m[1]).padStart(2, "0");
        mo = String(m[2]).padStart(2, "0");
        y = String(m[3]);
      }
      return { kind, date: `${y}-${mo}-${d}` };
    }
  }
  return null;
}

async function scrapeDatesFromPage(url?: string): Promise<string[]> {
  if (!url) return [];
  try {
    const r = await fetch(url, { headers: { Accept: "text/html" } });
    if (!r.ok) return [];
    const html = await r.text();
    const dates: string[] = [];
    const patterns: RegExp[] = [
      /(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/g,
      /(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})/g,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        let y: string, mo: string, d: string;
        if (re === patterns[0]) {
          y = m[1]; mo = String(m[2]).padStart(2, "0"); d = String(m[3]).padStart(2, "0");
        } else {
          d = String(m[1]).padStart(2, "0"); mo = String(m[2]).padStart(2, "0"); y = String(m[3]);
        }
        dates.push(`${y}-${mo}-${d}`);
      }
    }
    return Array.from(new Set(dates));
  } catch {
    return [];
  }
}

export async function importExamsFromProducts(
  baseUrl: string,
  key: string,
  secret: string,
) {
  let page = 1;
  const perPage = 100;
  let imported = 0;

  const findDatesInString = (s: string): string[] => {
    const results: string[] = [];
    const upper = s.toUpperCase();
    const patterns: RegExp[] = [
      /(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/g, // YYYY-MM-DD
      /(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})/g, // DD-MM-YYYY
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      // reset lastIndex just in case
      re.lastIndex = 0;
      while ((m = re.exec(upper))) {
        let y: string, mo: string, d: string;
        if (m.length === 4 && re === patterns[0]) {
          y = m[1];
          mo = String(m[2]).padStart(2, "0");
          d = String(m[3]).padStart(2, "0");
        } else {
          d = String(m[1]).padStart(2, "0");
          mo = String(m[2]).padStart(2, "0");
          y = String(m[3]);
        }
        results.push(`${y}-${mo}-${d}`);
      }
    }
    return Array.from(new Set(results));
  };

  const collectDatesFromValue = (val: any): string[] => {
    const acc: string[] = [];
    if (val == null) return acc;
    if (typeof val === "string") {
      // Try parse JSON
      if (val.trim().startsWith("{") || val.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(val);
          acc.push(...collectDatesFromValue(parsed));
        } catch {
          acc.push(...findDatesInString(val));
        }
      } else {
        acc.push(...findDatesInString(val));
      }
    } else if (Array.isArray(val)) {
      for (const it of val) acc.push(...collectDatesFromValue(it));
    } else if (typeof val === "object") {
      for (const v of Object.values(val)) acc.push(...collectDatesFromValue(v));
    }
    return acc;
  };

  const extractFromProduct = async (
    prod: any,
  ): Promise<{ dates: string[]; kind: string | null }> => {
    const baseText = `${prod?.name ?? ""} ${prod?.short_description ?? ""} ${prod?.description ?? ""}`;
    const kind = detectKind(String(prod?.name || "")) || detectKind(baseText) || detectKind(String(prod?.sku || ""));

    // Attributes (options array)
    let dates: string[] = [];
    const attrs: any[] = Array.isArray(prod?.attributes) ? prod.attributes : [];
    for (const a of attrs) dates.push(...collectDatesFromValue(a?.options));

    // Meta data for addons
    const meta: any[] = Array.isArray(prod?.meta_data) ? prod.meta_data : [];
    const relevant = meta.filter((m) =>
      [
        "_product_addons",
        "pewc_groups",
        "product_addons",
        "_product_addons_experimental",
        "tm_meta",
        "tm_meta_cpf",
      ].includes(String(m?.key || m?.name || "")),
    );
    for (const m of relevant) dates.push(...collectDatesFromValue(m?.value));
    if (dates.length === 0)
      for (const m of meta) dates.push(...collectDatesFromValue(m?.value));

    // Fallback: scrape the public product page for radio labels with dates
    if (dates.length === 0 && prod?.permalink) {
      const scraped = await scrapeDatesFromPage(prod.permalink);
      if (scraped.length) dates.push(...scraped);
    }

    dates = Array.from(new Set(dates));
    return { dates, kind: kind || null };
  };

  for (;;) {
    const url = new URL("/wp-json/wc/v3/products", baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("status", "publish");
    url.searchParams.set("context", "edit");
    url.searchParams.set(
      "_fields",
      "id,name,sku,short_description,description,attributes,meta_data,permalink",
    );

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) break;
    const products: any[] = await res.json();
    if (!Array.isArray(products) || products.length === 0) break;

    for (const p of products) {
      // First pass on list payload
      let { dates, kind } = await extractFromProduct(p);

      // If no dates found, fetch full product record (may include full meta_data)
      if (dates.length === 0) {
        try {
          const pRes = await fetch(
            new URL(
              `/wp-json/wc/v3/products/${p.id}?consumer_key=${encodeURIComponent(key)}&consumer_secret=${encodeURIComponent(secret)}&context=edit&_fields=id,name,sku,short_description,description,attributes,meta_data,permalink`,
              baseUrl,
            ),
            { headers: { Accept: "application/json" } },
          );
          if (pRes.ok) {
            const full = await pRes.json();
            const r = await extractFromProduct(full);
            dates = r.dates;
            kind = kind || r.kind;
          }
        } catch {}
      }

      // If still none, try parse from textual content
      if (dates.length === 0) {
        const ptx = `${p?.name ?? ""} ${p?.short_description ?? ""} ${p?.description ?? ""}`;
        const parsed = parseExamFromText(ptx);
        if (parsed) {
          addExamIfNotExists(parsed.kind, parsed.date);
          imported++;
          continue;
        }
      }

      for (const d of dates) {
        const k =
          (
            kind ||
            detectKind(`${p?.name ?? ""} ${p?.sku ?? ""}`) ||
            ""
          ).trim() || "General";
        addExamIfNotExists(k as any, d);
        imported++;
      }
    }

    if (products.length < perPage) break;
    page++;
  }
  return imported;
}

export const initializeSetup: RequestHandler = async (req, res) => {
  const parsed = initSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid configuration",
      issues: parsed.error.flatten(),
    });
  }
  const { baseUrl, consumerKey, consumerSecret } = parsed.data;

  try {
    const testUrl = new URL("/wp-json/wc/v3/orders", baseUrl);
    testUrl.searchParams.set("consumer_key", consumerKey);
    testUrl.searchParams.set("consumer_secret", consumerSecret);
    testUrl.searchParams.set("per_page", "1");
    const response = await fetch(testUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`WooCommerce API error: ${response.status}`);
  } catch (e: any) {
    return res
      .status(400)
      .json({ message: e?.message || "Failed to connect to WooCommerce" });
  }

  saveWooConfig({ baseUrl, consumerKey, consumerSecret });

  const imported = await fetchWooOrdersPaged(
    baseUrl,
    consumerKey,
    consumerSecret,
  );
  const importedExams = await importExamsFromProducts(
    baseUrl,
    consumerKey,
    consumerSecret,
  );
  setSetting("setup_completed", "true");
  res.json({ success: true, imported, importedExams });
};
