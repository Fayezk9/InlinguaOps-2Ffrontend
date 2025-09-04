import { RequestHandler } from "express";
import { z } from "zod";
import { addExam, listExams, removeExams, getSetting, setSetting } from "../db/sqlite";

const addSchema = z.object({
  kind: z.enum(["B1", "B2", "C1"]).or(z.string().min(1)),
  dates: z.array(z.string().min(1)).min(1),
});

export const addExamsHandler: RequestHandler = async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
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
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
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
  if (!parsed.success) return res.status(400).json({ message: "Invalid URL", issues: parsed.error.flatten() });
  setSetting("cert_site_url", parsed.data.certSite);
  res.json({ success: true });
};
