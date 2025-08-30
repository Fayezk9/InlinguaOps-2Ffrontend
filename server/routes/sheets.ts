import type { Request, Response } from "express";
import crypto from "node:crypto";

let SA_EMAIL = process.env.GOOGLE_SA_EMAIL || "";
let SA_PRIVATE_KEY = process.env.GOOGLE_SA_PRIVATE_KEY || "";

function normalizeKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

async function getAccessToken() {
  if (!SA_EMAIL || !SA_PRIVATE_KEY) throw new Error("Service account not configured");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1h
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };
  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${b64(header)}.${b64(payload)}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  const signature = signer.sign(normalizeKey(SA_PRIVATE_KEY)).toString("base64url");
  const assertion = `${data}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token error ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function sheetsStatus(_req: Request, res: Response) {
  res.json({ configured: Boolean(SA_EMAIL && SA_PRIVATE_KEY) });
}

export async function sheetsConfig(req: Request, res: Response) {
  const { client_email, private_key } = (req.body || {}) as { client_email?: string; private_key?: string };
  if (!client_email || !private_key) return res.status(400).json({ error: "client_email and private_key required" });
  SA_EMAIL = client_email;
  SA_PRIVATE_KEY = private_key;
  try {
    await getAccessToken();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Invalid credentials" });
  }
}

export async function sheetsPreview(req: Request, res: Response) {
  const id = (req.query.id as string) || "";
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const token = await getAccessToken();
    // Get first sheet title
    const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets(properties(title))`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meta.ok) return res.status(400).json({ error: `Failed meta ${meta.status}` });
    const metaJson = (await meta.json()) as any;
    const title = metaJson?.sheets?.[0]?.properties?.title || "Sheet1";
    const range = encodeURIComponent(`${title}!A1:Z200`);
    const vals = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!vals.ok) return res.status(400).json({ error: `Failed values ${vals.status}` });
    const data = (await vals.json()) as any;
    res.json({ title, values: data.values || [] });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "failed" });
  }
}

export async function sheetsValues(req: Request, res: Response) {
  const id = (req.query.id as string) || "";
  const title = (req.query.title as string) || "";
  const range = (req.query.range as string) || "A1:ZZ1000";
  if (!id || !title) return res.status(400).json({ error: "id and title required" });
  try {
    const token = await getAccessToken();
    const encRange = encodeURIComponent(`${title}!${range}`);
    const vals = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encRange}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!vals.ok) return res.status(400).json({ error: `Failed values ${vals.status}` });
    const data = (await vals.json()) as any;
    res.json({ title, values: data.values || [] });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "failed" });
  }
}

export async function sheetsTabs(req: Request, res: Response) {
  const id = (req.query.id as string) || "";
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const token = await getAccessToken();
    const meta = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets(properties(title,sheetId,index))`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!meta.ok) return res.status(400).json({ error: `Failed meta ${meta.status}` });
    const metaJson = (await meta.json()) as any;
    const sheets = (metaJson?.sheets || [])
      .map((s: any) => ({
        title: s?.properties?.title ?? "",
        gid: String(s?.properties?.sheetId ?? ""),
        index: Number(s?.properties?.index ?? 0),
      }))
      .filter((s: any) => s.title && s.gid)
      .sort((a: any, b: any) => a.index - b.index);
    res.json({ sheets });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "failed" });
  }
}
