import { RequestHandler } from "express";
import { z } from "zod";
import type { FetchOrdersRequest, FetchOrdersResponse, OrderFetchResult, WooOrder } from "@shared/api";

const envSchema = z.object({
  WC_BASE_URL: z.string().url(),
  WC_CONSUMER_KEY: z.string().min(1),
  WC_CONSUMER_SECRET: z.string().min(1),
});

const requestSchema = z.object({
  orderIds: z.array(z.union([z.string(), z.number()])).min(1).max(500),
});

async function fetchOrder(baseUrl: string, key: string, secret: string, id: string | number): Promise<OrderFetchResult> {
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
        customerName: [data.billing?.first_name, data.billing?.last_name].filter(Boolean).join(" "),
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

async function withConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
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

export const fetchOrdersHandler: RequestHandler = async (req, res) => {
  const parseEnv = envSchema.safeParse({
    WC_BASE_URL: process.env.WC_BASE_URL,
    WC_CONSUMER_KEY: process.env.WC_CONSUMER_KEY,
    WC_CONSUMER_SECRET: process.env.WC_CONSUMER_SECRET,
  });
  if (!parseEnv.success) {
    return res.status(400).json({
      message:
        "WooCommerce environment not configured. Please set WC_BASE_URL, WC_CONSUMER_KEY, and WC_CONSUMER_SECRET via environment variables.",
      issues: parseEnv.error.flatten(),
    });
  }

  const parsed = requestSchema.safeParse(req.body as FetchOrdersRequest);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }

  const { orderIds } = parsed.data;
  const ids = orderIds.map((x) => (typeof x === "number" ? x : x.trim())).filter((x) => String(x).length > 0);

  const { WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = parseEnv.data;

  const results = await withConcurrency(ids, 6, (id) => fetchOrder(WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET, id));

  const response: FetchOrdersResponse = {
    results,
    okCount: results.filter((r) => r.ok).length,
    errorCount: results.filter((r) => !r.ok).length,
  };
  res.json(response);
};
