import type { RequestHandler } from "express";
import {
  initDB,
  listSimpleOrders,
  simpleOrdersStatus,
  upsertSimpleOrder,
  updateSimpleOrderPartial,
} from "../db/sqlite";

export const getSimpleOrdersStatus: RequestHandler = async (_req, res) => {
  await initDB().catch(() => {});
  const st = simpleOrdersStatus();
  res.json({ initialized: st.count > 0, lastAdded: st.lastAdded });
};

export const listSimpleOrdersHandler: RequestHandler = async (_req, res) => {
  await initDB().catch(() => {});
  const items = listSimpleOrders();
  res.json({ items });
};

export const saveSimpleOrdersHandler: RequestHandler = async (req, res) => {
  await initDB().catch(() => {});
  const items = Array.isArray((req.body as any)?.items)
    ? (req.body as any).items
    : [];
  let saved = 0;
  for (const it of items) {
    if (!it) continue;
    const row = {
      order_number: String(it.orderNumber || it.order_number || "").trim(),
      last_name: String(it.lastName || it.last_name || "").trim(),
      first_name: String(it.firstName || it.first_name || "").trim(),
      exam_kind: String(it.examKind || it.exam_kind || "").trim(),
      exam_part: String(it.examPart || it.exam_part || "").trim(),
      exam_date: String(it.examDate || it.exam_date || "").trim(),
      price: String(it.price ?? "").trim(),
    } as const;
    if (!row.order_number) continue;
    upsertSimpleOrder(row as any);
    saved++;
  }
  const st = simpleOrdersStatus();
  res.json({ saved, lastAdded: st.lastAdded });
};

export const updateSimpleOrdersHandler: RequestHandler = async (req, res) => {
  await initDB().catch(() => {});
  const items = Array.isArray((req.body as any)?.items)
    ? (req.body as any).items
    : [];
  let updated = 0;
  for (const it of items) {
    const orderNumber = String(it.orderNumber || it.order_number || "").trim();
    if (!orderNumber) continue;
    const changes: any = {};
    if ("lastName" in it || "last_name" in it)
      changes.last_name = String(it.lastName ?? it.last_name ?? "");
    if ("firstName" in it || "first_name" in it)
      changes.first_name = String(it.firstName ?? it.first_name ?? "");
    if ("price" in it) changes.price = String(it.price ?? "");
    updateSimpleOrderPartial(orderNumber, changes);
    updated++;
  }
  res.json({ updated });
};
