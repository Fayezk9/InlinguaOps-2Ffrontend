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

    const results = wooOrders.map((order: any) => ({
      wooOrder: {
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        currency: order.currency,
        customerName: [order.billing?.first_name, order.billing?.last_name]
          .filter(Boolean)
          .join(" "),
        email: order.billing?.email,
        phone: order.billing?.phone,
      },
      participantData: null,
    }));

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

  const response: FetchOrdersResponse = {
    results,
    okCount: results.filter((r) => r.ok).length,
    errorCount: results.filter((r) => !r.ok).length,
  };
  res.json(response);
};
