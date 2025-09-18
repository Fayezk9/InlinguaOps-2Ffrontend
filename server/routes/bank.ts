import type { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import {
  initDB,
  insertBankPdf,
  insertBankTransaction,
  listMatchesJoined,
  listUnmatchedTransactions,
  listOrders,
  insertTransactionMatch,
} from "../db/sqlite";

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function decodeBase64DataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:application\/(pdf|octet-stream);base64,(.+)$/i);
  const b64 = m ? m[2] : dataUrl.split(",")[1] || dataUrl;
  return Buffer.from(b64, "base64");
}

function extractTextFromPdfBuffer(buf: Buffer): string {
  // Minimalistic heuristic PDF text extraction: extract text within parentheses in content streams
  // This is not perfect but works for many text-based PDFs.
  const s = buf.toString("latin1");
  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    const start = s.indexOf("(", i);
    if (start < 0) break;
    let j = start + 1;
    let depth = 1;
    let out = "";
    let escaped = false;
    while (j < s.length && depth > 0) {
      const ch = s[j];
      if (escaped) {
        // naive unescape
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth--;
        if (depth === 0) break;
        out += ch;
      } else {
        out += ch;
      }
      j++;
    }
    if (out) parts.push(out);
    i = j + 1;
  }
  // Join and normalize whitespace
  return parts
    .map((t) => t.replace(/\r|\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeText(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSetSimilarity(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

function parseAmount(input: string): number | null {
  const m = input.match(/-?[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})/);
  if (!m) return null;
  const raw = m[0].replace(/\./g, "").replace(/,/g, ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function splitTransactionsFromText(text: string) {
  // Split by dates to create transaction-like blocks
  const re = /(\b\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\b)/g;
  const tokens = text.split(re).map((x) => x.trim()).filter(Boolean);
  const txs: { date: string | null; sender: string | null; amount: number | null; reference: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isDate = /^\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}$/.test(t);
    if (!isDate) continue;
    const block = [tokens[i]];
    let j = i + 1;
    while (j < tokens.length && !/^\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}$/.test(tokens[j])) {
      block.push(tokens[j]);
      j++;
    }
    i = j - 1;
    const blockText = block.join(" \n ");
    const amount = parseAmount(blockText);
    // Try to guess sender name as the longest capitalized token sequence
    const nameMatch = blockText.match(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'`-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'`-]+){0,3})/);
    const sender = nameMatch ? nameMatch[1] : null;
    const date = block[0] || null;
    txs.push({ date, sender, amount, reference: blockText.trim() });
  }
  if (!txs.length) {
    // Fallback: single transaction with full text as reference
    txs.push({ date: null, sender: null, amount: parseAmount(text), reference: text.trim() });
  }
  return txs;
}

export const uploadBankPdfHandler: RequestHandler = async (req, res) => {
  await initDB().catch(() => {});
  try {
    const contentBase64 = String((req.body as any)?.contentBase64 || "");
    if (!contentBase64) return res.status(400).json({ message: "Missing contentBase64" });
    const buf = decodeBase64DataUrl(contentBase64);
    const dir = path.join(process.cwd(), "data", "bank-pdfs");
    ensureDirSync(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${ts}.pdf`;
    const full = path.join(dir, filename);
    fs.writeFileSync(full, buf);
    const pdfId = insertBankPdf(filename, full);

    const text = extractTextFromPdfBuffer(buf);
    const txs = splitTransactionsFromText(text);

    // Fetch latest 150 orders for matching
    const orders = listOrders(150, 0);

    const results: any[] = [];

    for (const tx of txs) {
      const txId = insertBankTransaction({
        pdf_id: pdfId,
        date: tx.date,
        sender_name: tx.sender,
        amount: tx.amount ?? null,
        reference: tx.reference,
        file_path: full,
        status: "pending",
      });

      const candidates: any[] = [];
      const ref = tx.reference || "";
      // Order number in reference
      const nums = Array.from(ref.matchAll(/#?(\d{4,8})/g)).map((m) => m[1]);
      const uniqueNums = Array.from(new Set(nums));
      for (const num of uniqueNums) {
        const byNumber = orders.filter((o) => String(o.number).includes(num));
        for (const o of byNumber) {
          const amountMatch = tx.amount != null && Math.abs((tx.amount ?? 0) - Number(o.total)) < 0.005;
          insertTransactionMatch({
            transaction_id: txId,
            order_id: o.id,
            confidence: amountMatch ? 1 : 2,
            reason: "Order # in reference",
            name_score: null,
            amount_match: !!amountMatch,
            order_num_in_ref: true,
            reference_names: null,
          });
          candidates.push({ order: o, reason: "Order # in reference", confidence: amountMatch ? 1 : 2, amountMatch, nameScore: null, orderNum: true });
        }
      }

      // Name matching (including possible names in reference)
      const namesInRef = Array.from(ref.matchAll(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'`-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'`-]+)/g)).map((m) => m[1]);
      const candidatesNames = [tx.sender, ...namesInRef].filter(Boolean) as string[];
      const usedPairs = new Set<string>();
      for (const candName of candidatesNames) {
        for (const o of orders) {
          const score = tokenSetSimilarity(candName, o.customer_name);
          if (score >= 0.85) {
            const key = `${o.id}:${candName}`;
            if (usedPairs.has(key)) continue;
            usedPairs.add(key);
            const amountMatch = tx.amount != null && Math.abs((tx.amount ?? 0) - Number(o.total)) < 0.005;
            const conf = amountMatch ? 2 : 3;
            insertTransactionMatch({
              transaction_id: txId,
              order_id: o.id,
              confidence: conf,
              reason: `Name match ${score.toFixed(2)}`,
              name_score: score,
              amount_match: !!amountMatch,
              order_num_in_ref: false,
              reference_names: namesInRef.join(", ") || null,
            });
            candidates.push({ order: o, reason: `Name match ${score.toFixed(2)}`, confidence: conf, amountMatch, nameScore: score, orderNum: false });
          }
        }
      }

      results.push({ transactionId: txId, candidatesCount: candidates.length });
    }

    const matches = listMatchesJoined();
    const unmatched = listUnmatchedTransactions();

    res.json({ pdfId, saved: txs.length, matchesCount: matches.length, unmatchedCount: unmatched.length });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Upload failed" });
  }
};

export const getMatchesHandler: RequestHandler = async (_req, res) => {
  await initDB().catch(() => {});
  const rows = listMatchesJoined();
  res.json({ items: rows });
};

export const getUnmatchedHandler: RequestHandler = async (_req, res) => {
  await initDB().catch(() => {});
  const rows = listUnmatchedTransactions();
  res.json({ items: rows });
};
