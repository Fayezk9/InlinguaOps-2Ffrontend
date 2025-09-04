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

function parseExamFromText(
  text: string,
): { kind: "B1" | "B2" | "C1"; date: string } | null {
  const upper = text.toUpperCase();
  const kind = (
    upper.includes("B1")
      ? "B1"
      : upper.includes("B2")
        ? "B2"
        : upper.includes("C1")
          ? "C1"
          : null
  ) as "B1" | "B2" | "C1" | null;
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

async function importExamsFromProducts(
  baseUrl: string,
  key: string,
  secret: string,
) {
  let page = 1;
  const perPage = 100;
  let imported = 0;
  for (;;) {
    const url = new URL("/wp-json/wc/v3/products", baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("status", "publish");

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) break;
    const products: any[] = await res.json();
    if (!Array.isArray(products) || products.length === 0) break;

    for (const p of products) {
      const text = `${p?.name ?? ""} ${p?.short_description ?? ""} ${p?.description ?? ""}`;
      const parsed = parseExamFromText(text);
      if (parsed) {
        addExamIfNotExists(parsed.kind, parsed.date);
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
    return res
      .status(400)
      .json({
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
