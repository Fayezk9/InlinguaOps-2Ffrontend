import fs from "fs";
import path from "path";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbFilePath: string | null = null;
let initialized = false;

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file) => {
      const nm = path.join(
        process.cwd(),
        "node_modules",
        "sql.js",
        "dist",
        file,
      );
      if (fs.existsSync(nm)) return nm;
      return path.join(path.dirname(new URL(import.meta.url).pathname), file);
    },
  });
  return SQL;
}

export async function initDB(customPath?: string) {
  if (initialized) return;
  await loadSql();
  const baseDir = customPath
    ? path.dirname(customPath)
    : path.join(process.cwd(), "data");
  ensureDirSync(baseDir);
  dbFilePath = customPath ?? path.join(baseDir, "app.sqlite");

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL!.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL!.Database();
  }

  migrate();
  save();
  initialized = true;
}

function save() {
  if (!db || !dbFilePath) return;
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

function run(sql: string, params: any[] = []) {
  if (!db) throw new Error("DB not initialized");
  db.run(sql, params);
  save();
}

function get<T = any>(sql: string, params: any[] = []): T | undefined {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(sql, params);
  try {
    if (stmt.step()) {
      const row = stmt.getAsObject();
      return row as unknown as T;
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

function all<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(sql, params);
  const rows: T[] = [];
  try {
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
  } finally {
    stmt.free();
  }
  return rows;
}

function migrate() {
  run(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      number TEXT NOT NULL,
      status TEXT NOT NULL,
      total TEXT NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      payment_method TEXT,
      link TEXT
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT,
      quantity INTEGER,
      total TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      template_code TEXT,
      to_email TEXT,
      subject TEXT,
      body TEXT,
      sent_at TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );`,
  );

  // Minimal fetched orders table
  run(
    `CREATE TABLE IF NOT EXISTS orders_simple (
      order_number TEXT PRIMARY KEY,
      last_name TEXT,
      first_name TEXT,
      exam_kind TEXT,
      exam_part TEXT,
      exam_date TEXT,
      price TEXT,
      added_at TEXT NOT NULL
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      date TEXT NOT NULL
    );`,
  );

  // Bank uploads and reconciliation
  run(
    `CREATE TABLE IF NOT EXISTS bank_pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER NOT NULL,
      date TEXT,
      sender_name TEXT,
      amount REAL,
      reference TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY(pdf_id) REFERENCES bank_pdfs(id)
    );`,
  );

  run(
    `CREATE TABLE IF NOT EXISTS transaction_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      confidence INTEGER NOT NULL,
      reason TEXT NOT NULL,
      name_score REAL,
      amount_match INTEGER NOT NULL,
      order_num_in_ref INTEGER NOT NULL,
      reference_names TEXT,
      FOREIGN KEY(transaction_id) REFERENCES bank_transactions(id),
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );`,
  );
}

export type ExamRow = { id: number; kind: string; date: string };

export function addExam(kind: string, date: string) {
  run(`INSERT INTO exams(kind, date) VALUES(?, ?)`, [kind, date]);
}

export function addExamIfNotExists(kind: string, date: string) {
  const row = get<{ id: number }>(
    `SELECT id FROM exams WHERE kind = ? AND date = ? LIMIT 1`,
    [kind, date],
  );
  if (!row) addExam(kind, date);
}

export function removeExams(ids: number[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  run(`DELETE FROM exams WHERE id IN (${placeholders})`, ids as any);
}

export function listExams(kind?: string): ExamRow[] {
  if (kind) {
    return all<ExamRow>(
      `SELECT * FROM exams WHERE kind = ? ORDER BY datetime(date) ASC`,
      [kind],
    );
  }
  return all<ExamRow>(`SELECT * FROM exams ORDER BY datetime(date) ASC`);
}

export function getSetting(key: string): string | undefined {
  const row = get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return row?.value;
}

export function setSetting(key: string, value: string) {
  run(
    `INSERT INTO settings(key, value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export type WooConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

export function saveWooConfig(config: WooConfig) {
  setSetting("woo_base_url", config.baseUrl);
  setSetting("woo_consumer_key", config.consumerKey);
  setSetting("woo_consumer_secret", config.consumerSecret);
}

export function loadWooConfig(): WooConfig | null {
  const baseUrl = getSetting("woo_base_url");
  const consumerKey = getSetting("woo_consumer_key");
  const consumerSecret = getSetting("woo_consumer_secret");
  if (!baseUrl || !consumerKey || !consumerSecret) return null;
  return { baseUrl, consumerKey, consumerSecret };
}

export type OrderRow = {
  id: number;
  number: string;
  status: string;
  total: string;
  currency: string;
  created_at: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  payment_method: string | null;
  link: string | null;
};

export function upsertOrder(row: OrderRow) {
  run(
    `INSERT INTO orders(id, number, status, total, currency, created_at, customer_name, email, phone, payment_method, link)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       number=excluded.number,
       status=excluded.status,
       total=excluded.total,
       currency=excluded.currency,
       created_at=excluded.created_at,
       customer_name=excluded.customer_name,
       email=excluded.email,
       phone=excluded.phone,
       payment_method=excluded.payment_method,
       link=excluded.link`,
    [
      row.id,
      row.number,
      row.status,
      row.total,
      row.currency,
      row.created_at,
      row.customer_name,
      row.email,
      row.phone,
      row.payment_method,
      row.link,
    ],
  );
}

export function listOrders(limit = 100, offset = 0): OrderRow[] {
  return all<OrderRow>(
    `SELECT * FROM orders ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export function insertBankPdf(filename: string, p: string) {
  run(`INSERT INTO bank_pdfs(filename, path, uploaded_at) VALUES(?,?,?)`, [filename, p, new Date().toISOString()]);
  const row = get<{ id: number }>(`SELECT last_insert_rowid() as id`);
  return row?.id as number;
}

export type BankTransactionRow = {
  id: number;
  pdf_id: number;
  date: string | null;
  sender_name: string | null;
  amount: number | null;
  reference: string;
  file_path: string;
  status: string;
};

export function insertBankTransaction(row: Omit<BankTransactionRow, "id" | "status"> & { status?: string }) {
  run(
    `INSERT INTO bank_transactions(pdf_id, date, sender_name, amount, reference, file_path, status) VALUES(?,?,?,?,?,?,?)`,
    [row.pdf_id, row.date ?? null, row.sender_name ?? null, row.amount ?? null, row.reference, row.file_path, row.status ?? 'pending'],
  );
  const r = get<{ id: number }>(`SELECT last_insert_rowid() as id`);
  return r?.id as number;
}

export function insertTransactionMatch(params: { transaction_id: number; order_id: number; confidence: number; reason: string; name_score?: number | null; amount_match: boolean; order_num_in_ref: boolean; reference_names?: string | null; }) {
  run(
    `INSERT INTO transaction_matches(transaction_id, order_id, confidence, reason, name_score, amount_match, order_num_in_ref, reference_names)
     VALUES(?,?,?,?,?,?,?,?)`,
    [
      params.transaction_id,
      params.order_id,
      params.confidence,
      params.reason,
      params.name_score ?? null,
      params.amount_match ? 1 : 0,
      params.order_num_in_ref ? 1 : 0,
      params.reference_names ?? null,
    ],
  );
}

export function listMatchesJoined() {
  return all<any>(
    `SELECT m.id as match_id, m.confidence, m.reason, m.name_score, m.amount_match, m.order_num_in_ref, m.reference_names,
            t.id as transaction_id, t.date as tx_date, t.sender_name as tx_sender, t.amount as tx_amount, t.reference as tx_reference, t.file_path as tx_file,
            o.id as order_id, o.number as order_number, o.created_at as order_date, o.customer_name as order_name, o.total as order_total
     FROM transaction_matches m
     JOIN bank_transactions t ON t.id = m.transaction_id
     JOIN orders o ON o.id = m.order_id
     ORDER BY m.confidence ASC, datetime(o.created_at) DESC`);
}

export function listUnmatchedTransactions() {
  return all<any>(
    `SELECT t.* FROM bank_transactions t
     LEFT JOIN transaction_matches m ON m.transaction_id = t.id
     WHERE m.id IS NULL
     ORDER BY datetime(t.date) DESC NULLS LAST, t.id DESC`);
}

export function setTransactionStatus(id: number, status: 'pending' | 'reconciled' | 'ignored') {
  run(`UPDATE bank_transactions SET status = ? WHERE id = ?`, [status, id]);
}

// Simple orders API
export type SimpleOrderRow = {
  order_number: string;
  last_name: string;
  first_name: string;
  exam_kind: string;
  exam_part: string;
  exam_date: string;
  price: string;
  added_at: string;
};

export function upsertSimpleOrder(row: Omit<SimpleOrderRow, "added_at">) {
  const now = new Date().toISOString();
  run(
    `INSERT INTO orders_simple(order_number, last_name, first_name, exam_kind, exam_part, exam_date, price, added_at)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(order_number) DO UPDATE SET
       last_name=excluded.last_name,
       first_name=excluded.first_name,
       exam_kind=excluded.exam_kind,
       exam_part=excluded.exam_part,
       exam_date=excluded.exam_date,
       price=excluded.price,
       added_at=excluded.added_at`,
    [
      row.order_number,
      row.last_name,
      row.first_name,
      row.exam_kind,
      row.exam_part,
      row.exam_date,
      row.price,
      now,
    ],
  );
}

export function listSimpleOrders(): SimpleOrderRow[] {
  return all<SimpleOrderRow>(
    `SELECT * FROM orders_simple ORDER BY datetime(added_at) DESC`,
  );
}

export function updateSimpleOrderPartial(
  order_number: string,
  changes: Partial<Pick<SimpleOrderRow, "last_name" | "first_name" | "price">>,
) {
  const sets: string[] = [];
  const params: any[] = [];
  if (changes.last_name != null) {
    sets.push("last_name = ?");
    params.push(changes.last_name);
  }
  if (changes.first_name != null) {
    sets.push("first_name = ?");
    params.push(changes.first_name);
  }
  if (changes.price != null) {
    sets.push("price = ?");
    params.push(changes.price);
  }
  if (!sets.length) return;
  params.push(order_number);
  run(`UPDATE orders_simple SET ${sets.join(", ")} WHERE order_number = ?`, params);
}

export function simpleOrdersStatus() {
  const row = get<{ cnt: number; lastAdded: string | null }>(
    `SELECT COUNT(*) as cnt, MAX(added_at) as lastAdded FROM orders_simple`,
  );
  return { count: row?.cnt || 0, lastAdded: row?.lastAdded || null };
}

export function clearSimpleOrders() {
  const row = get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM orders_simple`,
  );
  const count = row?.cnt || 0;
  run(`DELETE FROM orders_simple`);
  return count;
}
