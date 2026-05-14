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
const avatarDir = path.join(dataDir, "avatars");
const dbPath = path.join(dataDir, "dropstation.sqlite");
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const avatarMimeExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);
const avatarMimeTypes = new Map([
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const tokenAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

type FileRecordRow = {
  id: number;
  token: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  sha256: string;
  owner_user_id: number | null;
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
  ownerUserId: number | null;
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
    ownerUserId: row.owner_user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function ensureStorage() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(avatarDir, { recursive: true });
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
        owner_user_id INTEGER,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_sha256_expires_at
        ON files (sha256, expires_at);

      CREATE INDEX IF NOT EXISTS idx_files_stored_name
        ON files (stored_name);

      CREATE INDEX IF NOT EXISTS idx_files_token
        ON files (token);

      CREATE INDEX IF NOT EXISTS idx_files_owner_user_id
        ON files (owner_user_id, expires_at);

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username
        ON users (username);
    `);

    const userColumns = db
      .prepare("PRAGMA table_info(users)")
      .all() as { name: string }[];

    if (!userColumns.some((column) => column.name === "avatar_path")) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT");
    }
  }

  return db;
}

function avatarPathFor(storedName: string) {
  return path.join(avatarDir, storedName);
}

export function avatarUrl(storedName: string | null) {
  return storedName ? `/avatar/${encodeURIComponent(storedName)}` : null;
}

export function avatarContentType(storedName: string) {
  return avatarMimeTypes.get(path.extname(storedName).toLowerCase()) ?? "application/octet-stream";
}

export async function saveAvatar(file: File, userId: number) {
  await ensureStorage();

  if (file.size <= 0) {
    throw new Error("请选择一个非空头像文件");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("头像最大不能超过 5MB");
  }

  const extension = avatarMimeExtensions.get(file.type);

  if (!extension) {
    throw new Error("头像仅支持 JPG、PNG、WebP 或 GIF 图片");
  }

  const tempName = `.avatar-${randomBytes(16).toString("hex")}.tmp`;
  const tempPath = avatarPathFor(tempName);
  const storedName = `${userId}-${randomBytes(16).toString("hex")}${extension}`;
  const storedPath = avatarPathFor(storedName);
  let writtenBytes = 0;

  const writeStream = createWriteStream(tempPath, { flags: "wx" });
  const source = Readable.fromWeb(
    file.stream() as unknown as NodeReadableStream<Uint8Array>
  );

  source.on("data", (chunk: Buffer) => {
    writtenBytes += chunk.length;

    if (writtenBytes > MAX_AVATAR_SIZE) {
      source.destroy(new Error("头像最大不能超过 5MB"));
    }
  });

  try {
    await pipeline(source, writeStream);
    await rename(tempPath, storedPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return storedName;
}

export async function deleteAvatar(storedName: string | null) {
  if (!storedName || !/^[a-zA-Z0-9._-]+$/.test(storedName)) {
    return;
  }

  await unlink(avatarPathFor(storedName)).catch(() => undefined);
}

export async function openAvatar(storedName: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(storedName)) {
    return null;
  }

  const filePath = avatarPathFor(storedName);
  const fileStat = await stat(filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return null;
  }

  return {
    contentType: avatarContentType(storedName),
    size: fileStat.size,
    stream: createReadStream(filePath),
  };
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

export function createDownloadUrlFromHeaders(headers: Headers, token: string) {
  return createDownloadUrl({ headers, url: "http://localhost" }, token);
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

export async function saveUpload(file: File, expiresAt: number, ownerUserId?: number | null) {
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
        token, original_name, stored_name, mime_type, size, sha256, owner_user_id, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      token,
      file.name || "download",
      storedName,
      file.type || "application/octet-stream",
      file.size,
      sha256,
      ownerUserId ?? null,
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
      ownerUserId: ownerUserId ?? null,
      expiresAt,
      createdAt,
    },
    duplicate: false,
  };
}

export async function regenerateSharedFile(
  token: string,
  expiresAt: number,
  ownerUserId?: number | null
) {
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
        token, original_name, stored_name, mime_type, size, sha256, owner_user_id, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nextToken,
      sourceRow.original_name,
      sourceRow.stored_name,
      sourceRow.mime_type,
      sourceRow.size,
      sourceRow.sha256,
      ownerUserId ?? sourceRow.owner_user_id,
      expiresAt,
      createdAt
    );

  return rowToFile({
    ...sourceRow,
    id: Number(insertResult.lastInsertRowid),
    token: nextToken,
    owner_user_id: ownerUserId ?? sourceRow.owner_user_id,
    expires_at: expiresAt,
    created_at: createdAt,
  });
}

export async function getSharedFilesByOwner(ownerUserId: number) {
  await cleanupExpiredFiles();

  const database = await getDb();
  const rows = database
    .prepare(
      "SELECT * FROM files WHERE owner_user_id = ? AND expires_at > ? ORDER BY created_at DESC"
    )
    .all(ownerUserId, Date.now()) as FileRecordRow[];

  return rows.map(rowToFile);
}

export async function deleteSharedFileByOwner(token: string, ownerUserId: number) {
  await cleanupExpiredFiles();

  const database = await getDb();
  const row = database
    .prepare("SELECT * FROM files WHERE token = ? AND owner_user_id = ? LIMIT 1")
    .get(token, ownerUserId) as FileRecordRow | undefined;

  if (!row) {
    return false;
  }

  await deleteSharedFile(rowToFile(row));
  return true;
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
