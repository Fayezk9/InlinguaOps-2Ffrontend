import { RequestHandler } from "express";
import { getSetting, setSetting } from "../db/sqlite";

const KEY = "school_address";
const LOGO_KEY = "school_logo";

export const getSchoolAddress: RequestHandler = async (_req, res) => {
  try {
    const raw = getSetting(KEY);
    if (!raw) return res.json({ address: null });
    try {
      const parsed = JSON.parse(raw);
      return res.json({ address: parsed });
    } catch {
      return res.json({ address: null });
    }
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to load" });
  }
};

export const saveSchoolAddress: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const address = {
      firstName: String(body.firstName ?? "").trim(),
      lastName: String(body.lastName ?? "").trim(),
      street: String(body.street ?? "").trim(),
      houseNumber: String(body.houseNumber ?? "").trim(),
      zip: String(body.zip ?? "").trim(),
      city: String(body.city ?? "").trim(),
    };
    setSetting(KEY, JSON.stringify(address));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to save" });
  }
};

export const getSchoolLogo: RequestHandler = async (_req, res) => {
  try {
    const raw = getSetting(LOGO_KEY);
    if (!raw) return res.json({ logo: null });
    return res.json({ logo: raw });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to load" });
  }
};

export const saveSchoolLogo: RequestHandler = async (req, res) => {
  try {
    const b64 = String(req.body?.contentBase64 || "").trim();
    if (!b64) return res.status(400).json({ message: "No content" });
    const data = b64.includes(",") ? b64 : `data:image/png;base64,${b64}`;
    const head = data.slice(0, data.indexOf(","));
    if (!/^data:image\/(png|jpe?g|gif);base64$/i.test(head))
      return res.status(400).json({ message: "Invalid image type" });
    const payload = data.slice(data.indexOf(",") + 1);
    try {
      Buffer.from(payload, "base64");
    } catch {
      return res.status(400).json({ message: "Invalid base64" });
    }
    setSetting(LOGO_KEY, data);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to save" });
  }
};
