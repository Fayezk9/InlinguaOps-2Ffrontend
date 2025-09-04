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
      const nm = path.join(process.cwd(), "node_modules", "sql.js", "dist", file);
      if (fs.existsSync(nm)) return nm;
      return path.join(path.dirname(new URL(import.meta.url).pathname), file);
    },
  });
  return SQL;
}

export async function initDB(customPath?: string) {
  if (initialized) return;
  await loadSql();
  const baseDir = customPath ? path.dirname(customPath) : path.join(process.cwd(), "data");
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

  run(
    `CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      date TEXT NOT NULL
    );`,
  );
}

export type ExamRow = { id: number; kind: string; date: string };

export function addExam(kind: string, date: string) {
  run(`INSERT INTO exams(kind, date) VALUES(?, ?)`, [kind, date]);
}

export function addExamIfNotExists(kind: string, date: string) {
  const row = get<{ id: number }>(`SELECT id FROM exams WHERE kind = ? AND date = ? LIMIT 1`, [kind, date]);
  if (!row) addExam(kind, date);
}

export function removeExams(ids: number[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  run(`DELETE FROM exams WHERE id IN (${placeholders})`, ids as any);
}

export function listExams(kind?: string): ExamRow[] {
  if (kind) {
    return all<ExamRow>(`SELECT * FROM exams WHERE kind = ? ORDER BY datetime(date) ASC`, [kind]);
  }
  return all<ExamRow>(`SELECT * FROM exams ORDER BY datetime(date) ASC`);
}

export function getSetting(key: string): string | undefined {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value;
}

export function setSetting(key: string, value: string) {
  run(
    `INSERT INTO settings(key, value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export type WooConfig = { baseUrl: string; consumerKey: string; consumerSecret: string };

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
