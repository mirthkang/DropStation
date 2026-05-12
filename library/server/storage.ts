import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { DatabaseSync } from "node:sqlite";

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
export const MAX_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

const dataDir = path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads");
const dbPath = path.join(dataDir, "dropstation.sqlite");

type FileRecordRow = {
  id: number;
  token: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  sha256: string;
  expires_at: number;
  created_at: number;
};

export type SharedFile = {
  id: number;
  token: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  sha256: string;
  expiresAt: number;
  createdAt: number;
};

let db: DatabaseSync | null = null;

function rowToFile(row: FileRecordRow): SharedFile {
  return {
    id: row.id,
    token: row.token,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    sha256: row.sha256,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function ensureStorage() {
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
}

export async function getDb() {
  await ensureStorage();

  if (!db) {
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_sha256_expires_at
        ON files (sha256, expires_at);

      CREATE INDEX IF NOT EXISTS idx_files_token
        ON files (token);
    `);
  }

  return db;
}

export function validateExpiresAt(expiresAt: number) {
  const now = Date.now();

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return "请选择一个未来的过期时间";
  }

  if (expiresAt > now + MAX_EXPIRES_MS) {
    return "过期时间不能超过 30 天";
  }

  return null;
}

export function safeDownloadName(name: string) {
  return name.replace(/[\r\n"]/g, "_");
}

export function contentDispositionForDownload(name: string) {
  const filename = safeDownloadName(name) || "download";
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function createDownloadUrl(requestUrl: string, token: string) {
  const url = new URL(requestUrl);
  return `${url.origin}/d/${token}`;
}

function createShortToken(database: DatabaseSync) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = randomBytes(6).toString("base64url");
    const existing = database
      .prepare("SELECT id FROM files WHERE token = ? LIMIT 1")
      .get(token);

    if (!existing) {
      return token;
    }
  }

  return randomBytes(9).toString("base64url");
}

export async function cleanupExpiredFiles() {
  const database = await getDb();
  const now = Date.now();
  const expiredRows = database
    .prepare("SELECT * FROM files WHERE expires_at <= ?")
    .all(now) as FileRecordRow[];

  for (const row of expiredRows) {
    await unlink(path.join(uploadsDir, row.stored_name)).catch(() => undefined);
  }

  database.prepare("DELETE FROM files WHERE expires_at <= ?").run(now);
}

export async function saveUpload(file: File, expiresAt: number) {
  await cleanupExpiredFiles();

  if (file.size <= 0) {
    throw new Error("请选择一个非空文件");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("文件最大不能超过 1GB");
  }

  const expiresError = validateExpiresAt(expiresAt);

  if (expiresError) {
    throw new Error(expiresError);
  }

  const tempName = `.upload-${randomBytes(16).toString("hex")}.tmp`;
  const tempPath = path.join(uploadsDir, tempName);
  const hash = createHash("sha256");
  let writtenBytes = 0;

  const writeStream = createWriteStream(tempPath, { flags: "wx" });
  const source = Readable.fromWeb(
    file.stream() as unknown as NodeReadableStream<Uint8Array>
  );

  source.on("data", (chunk: Buffer) => {
    writtenBytes += chunk.length;
    hash.update(chunk);

    if (writtenBytes > MAX_FILE_SIZE) {
      source.destroy(new Error("文件最大不能超过 1GB"));
    }
  });

  try {
    await pipeline(source, writeStream);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  if (writtenBytes !== file.size) {
    await unlink(tempPath).catch(() => undefined);
    throw new Error("文件上传不完整，请重试");
  }

  const sha256 = hash.digest("hex");
  const database = await getDb();
  const existingRows = database
    .prepare("SELECT * FROM files WHERE sha256 = ? AND expires_at > ? ORDER BY expires_at DESC")
    .all(sha256, Date.now()) as FileRecordRow[];

  for (const existing of existingRows) {
    const existingPath = path.join(uploadsDir, existing.stored_name);
    const exists = await stat(existingPath)
      .then((fileStat) => fileStat.isFile())
      .catch(() => false);

    if (exists) {
      await unlink(tempPath).catch(() => undefined);
      return { file: rowToFile(existing), duplicate: true };
    }

    database.prepare("DELETE FROM files WHERE id = ?").run(existing.id);
  }

  const extension = path.extname(file.name).slice(0, 32).replace(/[^a-zA-Z0-9._-]/g, "");
  const token = createShortToken(database);
  const storedName = `${token}${extension}`;
  const storedPath = path.join(uploadsDir, storedName);
  const createdAt = Date.now();

  await rename(tempPath, storedPath);

  const insertResult = database
    .prepare(
      `INSERT INTO files (
        token, original_name, stored_name, mime_type, size, sha256, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      token,
      file.name || "download",
      storedName,
      file.type || "application/octet-stream",
      file.size,
      sha256,
      expiresAt,
      createdAt
    );

  return {
    file: {
      id: Number(insertResult.lastInsertRowid),
      token,
      originalName: file.name || "download",
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      sha256,
      expiresAt,
      createdAt,
    },
    duplicate: false,
  };
}

export async function getSharedFile(token: string) {
  await cleanupExpiredFiles();

  const database = await getDb();
  const row = database
    .prepare("SELECT * FROM files WHERE token = ? AND expires_at > ? LIMIT 1")
    .get(token, Date.now()) as FileRecordRow | undefined;

  return row ? rowToFile(row) : null;
}

export async function deleteSharedFile(sharedFile: SharedFile) {
  const database = await getDb();

  await unlink(path.join(uploadsDir, sharedFile.storedName)).catch(() => undefined);
  database.prepare("DELETE FROM files WHERE id = ?").run(sharedFile.id);
}

export async function openSharedFile(sharedFile: SharedFile) {
  const filePath = path.join(uploadsDir, sharedFile.storedName);
  const fileStat = await stat(filePath);

  return {
    filePath,
    size: fileStat.size,
    stream: createReadStream(filePath),
  };
}
