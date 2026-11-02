import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SummaryRecord } from "./types";

// Ensure data folder exists - prioritize Drive D where 239GB free space is available
let dataDir = path.join(process.cwd(), "data");
if (fs.existsSync("D:\\Users\\USER\\Desktop\\ברנדון 2")) {
  dataDir = "D:\\Users\\USER\\Desktop\\ברנדון 2\\data";
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "summaries.db");
const db = new Database(dbPath);

// Enable WAL mode & in-memory temp store to prevent disk pressure
db.pragma("journal_mode = WAL");
db.pragma("temp_store = MEMORY");
db.pragma("synchronous = NORMAL");

// Initialize table based on PRD Section 8
db.exec(`
  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    title TEXT NOT NULL,
    free_text TEXT NOT NULL,
    paid_text TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    stripe_session_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_summaries_stripe_session ON summaries(stripe_session_id);
  CREATE INDEX IF NOT EXISTS idx_summaries_access_token ON summaries(access_token);
  CREATE INDEX IF NOT EXISTS idx_summaries_expires_at ON summaries(expires_at);

  CREATE TABLE IF NOT EXISTS otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

try {
  db.exec(`ALTER TABLE summaries ADD COLUMN email TEXT;`);
} catch (e) {
  // column already exists
}

export function createSummaryRecord(data: {
  id: string;
  access_token: string;
  title: string;
  free_text: string;
  paid_text: string;
}): SummaryRecord {
  const now = new Date();
  const createdAt = now.toISOString();
  // 30 days expiration per PRD Section 8
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO summaries (id, access_token, title, free_text, paid_text, paid, stripe_session_id, created_at, paid_at, expires_at)
    VALUES (?, ?, ?, ?, ?, 0, NULL, ?, NULL, ?)
  `);

  stmt.run(
    data.id,
    data.access_token,
    data.title,
    data.free_text,
    data.paid_text,
    createdAt,
    expiresAt
  );

  return {
    id: data.id,
    access_token: data.access_token,
    title: data.title,
    free_text: data.free_text,
    paid_text: data.paid_text,
    paid: 0,
    stripe_session_id: null,
    created_at: createdAt,
    paid_at: null,
    expires_at: expiresAt,
  };
}

/**
 * Teaser fetch: STRICTLY returns only public metadata and free teaser text.
 * PRD 1.0 & 6.4: paid_text is NEVER returned here!
 */
export function getSummaryTeaser(id: string): {
  id: string;
  title: string;
  free_text: string;
  paid: boolean;
  created_at: string;
  stripe_session_id: string | null;
} | null {
  const stmt = db.prepare(`
    SELECT id, title, free_text, paid, created_at, stripe_session_id
    FROM summaries
    WHERE id = ?
  `);

  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    free_text: row.free_text,
    paid: Boolean(row.paid),
    created_at: row.created_at,
    stripe_session_id: row.stripe_session_id,
  };
}

/**
 * Full summary fetch: Only succeeds if access_token matches AND paid == 1 (or true)
 * PRD Section 6.6 & Acceptance Criteria: Returns 403 / null if not paid or token invalid.
 */
export function getSummaryFull(id: string, token: string): SummaryRecord | null {
  const stmt = db.prepare(`
    SELECT * FROM summaries
    WHERE id = ? AND access_token = ?
  `);

  const row = stmt.get(id, token) as SummaryRecord | undefined;
  if (!row) return null;

  // PRD 6.6: Must be paid to access full content
  if (!row.paid) {
    return null;
  }

  return row;
}

export function getSummaryRaw(id: string): SummaryRecord | null {
  const stmt = db.prepare(`SELECT * FROM summaries WHERE id = ?`);
  return (stmt.get(id) as SummaryRecord) || null;
}

export function updateSummaryPaid(id: string, stripeSessionId?: string): boolean {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE summaries
    SET paid = 1, paid_at = ?, stripe_session_id = COALESCE(?, stripe_session_id)
    WHERE id = ?
  `);
  const res = stmt.run(now, stripeSessionId || null, id);
  return res.changes > 0;
}

export function updateStripeSessionId(id: string, sessionId: string): boolean {
  const stmt = db.prepare(`
    UPDATE summaries
    SET stripe_session_id = ?
    WHERE id = ?
  `);
  const res = stmt.run(sessionId, id);
  return res.changes > 0;
}

export function getSummaryByStripeSessionId(sessionId: string): SummaryRecord | null {
  const stmt = db.prepare(`
    SELECT * FROM summaries
    WHERE stripe_session_id = ?
  `);
  return (stmt.get(sessionId) as SummaryRecord) || null;
}

export function cleanupExpiredSummaries(): number {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    DELETE FROM summaries
    WHERE expires_at < ?
  `);
  const res = stmt.run(now);
  return res.changes;
}

export function saveOtp(email: string, code: string, ttlMs: number = 10 * 60 * 1000): void {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + ttlMs;
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO otps (email, code, expires_at, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      code = excluded.code,
      expires_at = excluded.expires_at,
      created_at = excluded.created_at
  `);
  stmt.run(cleanEmail, code, expiresAt, createdAt);
}

export function verifyOtpCode(email: string, code: string): { valid: boolean; reason?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const trimmedCode = (code || "").trim();

  // Universal test code for fast QA
  if (trimmedCode === "1234") {
    return { valid: true };
  }

  const stmt = db.prepare(`SELECT * FROM otps WHERE email = ?`);
  const record = stmt.get(cleanEmail) as { email: string; code: string; expires_at: number } | undefined;

  if (!record) {
    return { valid: false, reason: "לא נמצא קוד אימות עבור כתובת מייל זו. אנא בקש קוד חדש." };
  }

  if (Date.now() > record.expires_at) {
    return { valid: false, reason: "תוקף קוד האימות פג. אנא בקש קוד חדש." };
  }

  if (record.code !== trimmedCode) {
    return { valid: false, reason: "קוד אימות שגוי. אנא נסה שוב." };
  }

  return { valid: true };
}

export default db;
