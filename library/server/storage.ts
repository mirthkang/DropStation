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

const tokenAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

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
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_sha256_expires_at
        ON files (sha256, expires_at);

      CREATE INDEX IF NOT EXISTS idx_files_stored_name
        ON files (stored_name);

      CREATE INDEX IF NOT EXISTS idx_files_token
        ON files (token);
    `);
    migrateStoredNameUniqueness(db);
  }

  return db;
}

function migrateStoredNameUniqueness(database: DatabaseSync) {
  const indexes = database.prepare("PRAGMA index_list(files)").all() as Array<{
    name: string;
    unique: number;
  }>;
  const hasStoredNameUniqueIndex = indexes.some((index) => {
    if (!index.unique) return false;

    const columns = database
      .prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`)
      .all() as Array<{ name: string }>;

    return columns.length === 1 && columns[0]?.name === "stored_name";
  });

  if (!hasStoredNameUniqueIndex) {
    return;
  }

  database.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE files_next (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    INSERT INTO files_next (
      id, token, original_name, stored_name, mime_type, size, sha256, expires_at, created_at
    )
    SELECT id, token, original_name, stored_name, mime_type, size, sha256, expires_at, created_at
    FROM files;

    DROP TABLE files;
    ALTER TABLE files_next RENAME TO files;

    CREATE INDEX idx_files_sha256_expires_at
      ON files (sha256, expires_at);

    CREATE INDEX idx_files_stored_name
      ON files (stored_name);

    CREATE INDEX idx_files_token
      ON files (token);

    COMMIT;
  `);
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

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function requestOrigin(request: Pick<Request, "headers" | "url">) {
  const fallbackUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));

  if (forwardedHost) {
    const protocol =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
      fallbackUrl.protocol.replace(":", "");

    return `${protocol}://${forwardedHost}`;
  }

  const origin = request.headers.get("origin");

  if (origin) {
    return new URL(origin).origin;
  }

  const host = firstHeaderValue(request.headers.get("host"));

  if (host) {
    const protocol =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
      fallbackUrl.protocol.replace(":", "");

    return `${protocol}://${host}`;
  }

  return fallbackUrl.origin;
}

export function createDownloadUrl(request: Pick<Request, "headers" | "url">, token: string) {
  return `${requestOrigin(request)}/d/${token}`;
}

function createShortToken(database: DatabaseSync) {
  const tokenExists = (token: string) =>
    Boolean(
      database.prepare("SELECT id FROM files WHERE token = ? LIMIT 1").get(token)
    );

  const createToken = (length: number) => {
    let token = "";

    while (token.length < length) {
      for (const byte of randomBytes(length)) {
        if (byte >= 248) continue;

        token += tokenAlphabet[byte % tokenAlphabet.length];

        if (token.length === length) {
          break;
        }
      }
    }

    return token;
  };

  for (let tokenLength = 6; tokenLength <= 12; tokenLength += 1) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const token = createToken(tokenLength);

      if (!tokenExists(token)) {
        return token;
      }
    }
  }

  throw new Error("无法生成唯一链接，请重试");
}

export async function cleanupExpiredFiles() {
  const database = await getDb();
  const now = Date.now();
  const expiredRows = database
    .prepare("SELECT * FROM files WHERE expires_at <= ?")
    .all(now) as FileRecordRow[];

  database.prepare("DELETE FROM files WHERE expires_at <= ?").run(now);

  for (const row of expiredRows) {
    const activeReference = database
      .prepare("SELECT id FROM files WHERE stored_name = ? LIMIT 1")
      .get(row.stored_name);

    if (!activeReference) {
      await unlink(path.join(uploadsDir, row.stored_name)).catch(() => undefined);
    }
  }
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

export async function regenerateSharedFile(token: string, expiresAt: number) {
  await cleanupExpiredFiles();

  const expiresError = validateExpiresAt(expiresAt);

  if (expiresError) {
    throw new Error(expiresError);
  }

  const database = await getDb();
  const sourceRow = database
    .prepare("SELECT * FROM files WHERE token = ? AND expires_at > ? LIMIT 1")
    .get(token, Date.now()) as FileRecordRow | undefined;

  if (!sourceRow) {
    throw new Error("原链接不可用，无法重新生成");
  }

  const sourcePath = path.join(uploadsDir, sourceRow.stored_name);
  const exists = await stat(sourcePath)
    .then((fileStat) => fileStat.isFile())
    .catch(() => false);

  if (!exists) {
    database.prepare("DELETE FROM files WHERE stored_name = ?").run(sourceRow.stored_name);
    throw new Error("源文件不存在，无法重新生成");
  }

  const nextToken = createShortToken(database);
  const createdAt = Date.now();
  const insertResult = database
    .prepare(
      `INSERT INTO files (
        token, original_name, stored_name, mime_type, size, sha256, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nextToken,
      sourceRow.original_name,
      sourceRow.stored_name,
      sourceRow.mime_type,
      sourceRow.size,
      sourceRow.sha256,
      expiresAt,
      createdAt
    );

  return rowToFile({
    ...sourceRow,
    id: Number(insertResult.lastInsertRowid),
    token: nextToken,
    expires_at: expiresAt,
    created_at: createdAt,
  });
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

  database.prepare("DELETE FROM files WHERE id = ?").run(sharedFile.id);

  const activeReference = database
    .prepare("SELECT id FROM files WHERE stored_name = ? LIMIT 1")
    .get(sharedFile.storedName);

  if (!activeReference) {
    await unlink(path.join(uploadsDir, sharedFile.storedName)).catch(() => undefined);
  }
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
