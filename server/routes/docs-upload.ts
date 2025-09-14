import type { RequestHandler } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const TEMPLATE_DIR = "data/docs/templates";
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, "registration.docx");

const uploadSchema = z.object({
  contentBase64: z.string().min(1),
  filename: z.string().optional(),
});

export const uploadRegistrationTemplate: RequestHandler = async (req, res) => {
  try {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid upload payload" });
    }
    const { contentBase64 } = parsed.data;
    const commaIdx = contentBase64.indexOf(",");
    const b64 = commaIdx >= 0 ? contentBase64.slice(commaIdx + 1) : contentBase64;
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      return res.status(400).json({ message: "Invalid base64 content" });
    }
    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    await fs.writeFile(TEMPLATE_PATH, buf);
    return res.json({ message: "Template uploaded", path: TEMPLATE_PATH });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to upload template" });
  }
};

export const getRegistrationTemplateStatus: RequestHandler = async (_req, res) => {
  try {
    const stat = await fs.stat(TEMPLATE_PATH).catch(() => null);
    if (!stat) return res.json({ exists: false });
    return res.json({ exists: true, size: stat.size, mtime: stat.mtimeMs, path: TEMPLATE_PATH });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to get template status" });
  }
};
