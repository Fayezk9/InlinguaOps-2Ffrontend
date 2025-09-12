import { RequestHandler } from "express";
import { z } from "zod";
import {
  addExam,
  listExams,
  removeExams,
  getSetting,
  setSetting,
  loadWooConfig,
} from "../db/sqlite";
import type { RequestHandler } from "express";
import { importExamsFromProducts } from "./setup";

const addSchema = z.object({
  kind: z.enum(["B1", "B2", "C1"]).or(z.string().min(1)),
  dates: z.array(z.string().min(1)).min(1),
});

export const addExamsHandler: RequestHandler = async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", issues: parsed.error.flatten() });
  const { kind, dates } = parsed.data;
  for (const d of dates) addExam(kind, d);
  res.json({ success: true, added: dates.length });
};

export const listExamsHandler: RequestHandler = async (req, res) => {
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const rows = listExams(kind);
  res.json({ exams: rows });
};

const removeSchema = z.object({ ids: z.array(z.number()).min(1) });
export const removeExamsHandler: RequestHandler = async (req, res) => {
  const parsed = removeSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid input", issues: parsed.error.flatten() });
  removeExams(parsed.data.ids);
  res.json({ success: true, removed: parsed.data.ids.length });
};

export const getCertConfig: RequestHandler = async (_req, res) => {
  const url = getSetting("cert_site_url") || null;
  res.json({ certSite: url });
};

export const setCertConfig: RequestHandler = async (req, res) => {
  const schema = z.object({ certSite: z.string().url() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid URL", issues: parsed.error.flatten() });
  setSetting("cert_site_url", parsed.data.certSite);
  res.json({ success: true });
};

export const syncExamsFromWoo: RequestHandler = async (_req, res) => {
  const cfg = loadWooConfig();
  if (!cfg) return res.status(400).json({ message: "WooCommerce not configured" });
  try {
    const imported = await importExamsFromProducts(
      cfg.baseUrl,
      cfg.consumerKey,
      cfg.consumerSecret,
    );
    res.json({ success: true, imported });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to import" });
  }
};

export const debugWooProducts: RequestHandler = async (req, res) => {
  const cfg = loadWooConfig();
  if (!cfg) return res.status(400).json({ message: "WooCommerce not configured" });
  const { limit = "5" } = req.query as { limit?: string };
  try {
    const url = new URL("/wp-json/wc/v3/products", cfg.baseUrl);
    url.searchParams.set("consumer_key", cfg.consumerKey);
    url.searchParams.set("consumer_secret", cfg.consumerSecret);
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("context", "edit");
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const products = (await r.json()) as any[];
    const sample = (products || []).slice(0, 3).map((p) => ({
      id: p?.id,
      name: p?.name,
      sku: p?.sku,
      attributes: p?.attributes,
      meta_data_keys: Array.isArray(p?.meta_data)
        ? p.meta_data.map((m: any) => m?.key || m?.name || "").slice(0, 50)
        : [],
      sample_meta: Array.isArray(p?.meta_data) ? p.meta_data.slice(0, 5) : [],
    }));
    res.json({ count: products?.length || 0, sample });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to read products" });
  }
};
