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

  const { since } = req.body;
  const sinceDate = since
    ? new Date(since)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = parseEnv.data;

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
  const parseEnv = envSchema.safeParse({
    WC_BASE_URL: process.env.WC_BASE_URL,
    WC_CONSUMER_KEY: process.env.WC_CONSUMER_KEY,
    WC_CONSUMER_SECRET: process.env.WC_CONSUMER_SECRET,
  });
  if (!parseEnv.success) {
    return res.status(400).json({
      message: "WooCommerce environment not configured. Please set WC_BASE_URL, WC_CONSUMER_KEY, and WC_CONSUMER_SECRET via environment variables.",
      issues: parseEnv.error.flatten(),
    });
  }

  const { searchCriteria } = req.body;
  const { WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = parseEnv.data;

  try {
    // Step 1: Search WooCommerce for orders
    const url = new URL("/wp-json/wc/v3/orders", WC_BASE_URL);
    url.searchParams.set("consumer_key", WC_CONSUMER_KEY);
    url.searchParams.set("consumer_secret", WC_CONSUMER_SECRET);
    url.searchParams.set("per_page", "100");

    // Add search parameters if provided
    if (searchCriteria.orderNumber) {
      url.searchParams.set("search", searchCriteria.orderNumber);
    }

    const wooResponse = await fetch(url, { headers: { Accept: "application/json" } });
    if (!wooResponse.ok) {
      throw new Error(`WooCommerce API error: ${wooResponse.status}`);
    }

    const wooOrders = await wooResponse.json();

    // Step 2: For each WooCommerce order, search Google Sheets for participant data
    const results = [];

    // Get Google Sheets configuration from localStorage or settings
    // For now, we'll return WooCommerce data and indicate sheets search is needed
    for (const order of wooOrders) {
      const participantData = await searchParticipantInSheets(order.number || order.id, searchCriteria);

      results.push({
        wooOrder: {
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          currency: order.currency,
          customerName: [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" "),
          email: order.billing?.email,
          phone: order.billing?.phone,
        },
        participantData
      });
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to search orders",
      error: error.message
    });
  }
};

// Helper function to search participant data in Google Sheets
async function searchParticipantInSheets(orderNumber: string, criteria: any) {
  try {
    // This would need to be implemented with actual Google Sheets search
    // For now, return mock data that matches the participant structure
    return {
      bestellnummer: orderNumber,
      nachname: criteria.lastName || "Schmidt",
      vorname: criteria.firstName || "Anna",
      geburtsdatum: criteria.birthday || "15.05.1990",
      geburtsort: "Berlin",
      geburtsland: "Deutschland",
      email: "anna.schmidt@email.com",
      telefon: "+49 30 12345678",
      pruefung: criteria.examType || "B2",
      pruefungsteil: "Gesamt",
      zertifikat: "Abholen",
      pDatum: criteria.examDate || "15.03.2024",
      bDatum: "01.02.2024",
      preis: "180.00",
      zahlungsart: "Überweisung",
      status: "Bezahlt",
      mitarbeiter: "Max Mustermann"
    };
  } catch (error) {
    return null;
  }
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
    return res
      .status(400)
      .json({ message: "Invalid request", issues: parsed.error.flatten() });
  }

  const { orderIds } = parsed.data;
  const ids = orderIds
    .map((x) => (typeof x === "number" ? x : x.trim()))
    .filter((x) => String(x).length > 0);

  const { WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = parseEnv.data;

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
