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
