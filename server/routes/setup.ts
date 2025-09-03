import { RequestHandler } from "express";
import { z } from "zod";
import { getSetting, setSetting, saveWooConfig, loadWooConfig, upsertOrder } from "../db/sqlite";
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

async function fetchWooOrdersPaged(baseUrl: string, key: string, secret: string) {
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
        customer_name: [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(" "),
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

export const initializeSetup: RequestHandler = async (req, res) => {
  const parsed = initSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid configuration", issues: parsed.error.flatten() });
  }
  const { baseUrl, consumerKey, consumerSecret } = parsed.data;

  try {
    const testUrl = new URL("/wp-json/wc/v3/orders", baseUrl);
    testUrl.searchParams.set("consumer_key", consumerKey);
    testUrl.searchParams.set("consumer_secret", consumerSecret);
    testUrl.searchParams.set("per_page", "1");
    const response = await fetch(testUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`WooCommerce API error: ${response.status}`);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || "Failed to connect to WooCommerce" });
  }

  saveWooConfig({ baseUrl, consumerKey, consumerSecret });

  const imported = await fetchWooOrdersPaged(baseUrl, consumerKey, consumerSecret);
  setSetting("setup_completed", "true");
  res.json({ success: true, imported });
};
