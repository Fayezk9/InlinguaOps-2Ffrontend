import type { RequestHandler } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";

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
    // Auto-fix: open docx and clean XML to keep placeholders contiguous
    let outBuf = buf;
    try {
      const zip = new PizZip(buf);
      const files = zip.file(/word\/.+\.xml$/i) || [];
      for (const f of files as any[]) {
        const name = (f as any).name || (f as any).options?.name;
        if (!name) continue;
        const original = zip.file(name)!.asText();
        let content = original;
        // Remove proofing markers that split runs
        content = content.replace(/<w:proofErr[^>]*\/>/g, "");
        // Merge adjacent runs' text nodes to avoid split placeholders
        const mergePattern = /<\/w:t>\s*<\/w:r>\s*<w:r[^>]*>\s*(?:<w:rPr>.*?<\/w:rPr>\s*)?<w:t[^>]*>/gs;
        for (let i = 0; i < 10 && mergePattern.test(content); i++) {
          content = content.replace(mergePattern, "");
        }
        // Normalize braces spacing and duplicates
        content = content
          .replace(/\{\{\{+/g, "{{")
          .replace(/\}+\}\}/g, "}}");
        content = content.replace(/\{\s+\{/g, "{{").replace(/\}\s+\}/g, "}}");
        if (content !== original) zip.file(name, content);
      }
      outBuf = zip.generate({ type: "nodebuffer" });
    } catch {
      // If cleaning fails, fall back to original buffer
      outBuf = buf;
    }

    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    await fs.writeFile(TEMPLATE_PATH, outBuf);
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

export const validateRegistrationTemplate: RequestHandler = async (_req, res) => {
  try {
    const stat = await fs.stat(TEMPLATE_PATH).catch(() => null);
    if (!stat) return res.status(400).json({ message: "No template uploaded" });
    const buf = await fs.readFile(TEMPLATE_PATH);
    // Parse docx and extract tags
    const PizZipMod = (await import("pizzip")).default;
    const DocxMod = (await import("docxtemplater")).default;
    const zip = new PizZipMod(buf);
    const xmlFiles = zip.file(/word\/.+\.xml$/i) || [];
    const contentAll: string[] = [];
    for (const f of xmlFiles as any[]) {
      const name = (f as any).name || (f as any).options?.name;
      if (!name) continue;
      const content = zip.file(name)!.asText();
      contentAll.push(content);
    }
    const joined = contentAll.join("\n");
    const tagMatches = Array.from(joined.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)).map((m) => (m[1] || "").trim());
    const tagsFound = Array.from(new Set(tagMatches));

    const baseKeys = [
      "orderNumber","firstName","lastName","fullName","email","phone","address1","address2","city","zip","country","examKind","examPart","examDate","dob","nationality","birthPlace","bookingDate","paymentMethod","price","priceEUR","today","todayISO","docDate","docDateISO"
    ];
    const aliasMap: Record<string,string> = {
      FIRSTNAME:"firstName",LASTNAME:"lastName",FULLNAME:"fullName",NAME:"fullName",EMAIL:"email",PHONE:"phone",ADDRESS1:"address1",ADDRESS2:"address2",CITY:"city",ZIP:"zip",COUNTRY:"country",ORDERNUMBER:"orderNumber",EXAMTYPE:"examKind",EXAM_KIND:"examKind",EXAMPART:"examPart",EXAM_PART:"examPart",EXAMDATE:"examDate",EXAM_DATE:"examDate",DOC_DATE:"docDate",TODAY:"today",DOB:"dob",NATIONALITY:"nationality",BIRTHPLACE:"birthPlace",PRICE:"price",PRICE_EUR:"priceEUR"
    };
    const allowed = new Set([...baseKeys, ...Object.keys(aliasMap)]);
    const unknownTags = tagsFound.filter((t) => !allowed.has(t));

    // Try rendering to detect malformed tags
    let docxError: any = null;
    try {
      const doc = new DocxMod(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
      const sampleData: Record<string, any> = Object.fromEntries([...allowed].map((k) => [k, "test"]));
      doc.setData(sampleData);
      doc.render();
    } catch (e: any) {
      const props = e?.properties;
      if (props?.errors && Array.isArray(props.errors)) {
        docxError = props.errors.map((err: any) => ({
          id: err?.properties?.id || err?.id,
          xtag: err?.properties?.xtag || err?.xtag,
          explanation: err?.properties?.explanation || err?.explanation,
          context: err?.properties?.context || err?.context,
          file: err?.properties?.file || err?.file,
        }));
      } else {
        docxError = [{ message: e?.message || String(e) }];
      }
    }

    const ok = unknownTags.length === 0 && (!docxError || (Array.isArray(docxError) && docxError.length === 0));
    return res.json({ ok, tagsFound, unknownTags, errors: docxError || [] });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to validate template" });
  }
};
