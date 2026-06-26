import { getDb } from "@/library/server/storage";

type UserRow = {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
  avatar_path: string | null;
  is_disabled: number;
  last_login_at: number | null;
};

export type User = {
  id: number;
  name: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: number;
  avatarPath: string | null;
  isDisabled: boolean;
  lastLoginAt: number | null;
};

export type AdminUserRecord = Omit<User, "passwordHash"> & {
  shareCount: number;
  storageBytes: number;
};

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
    avatarPath: row.avatar_path,
    isDisabled: row.is_disabled === 1,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserByUsername(username: string) {
  const database = await getDb();
  const row = database
    .prepare("SELECT * FROM users WHERE username = ? LIMIT 1")
    .get(username) as UserRow | undefined;

  return row ? rowToUser(row) : null;
}

export async function getUserById(id: number) {
  const database = await getDb();
  const row = database
    .prepare("SELECT * FROM users WHERE id = ? LIMIT 1")
    .get(id) as UserRow | undefined;

  return row ? rowToUser(row) : null;
}

export async function createUser(input: {
  name: string;
  username: string;
  passwordHash: string;
  isAdmin?: boolean;
}) {
  const database = await getDb();
  const existing = database
    .prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
    .get(input.username);

  if (existing) {
    throw new Error("用户名已存在。");
  }

  const userCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get() as { count: number };
  const isAdmin = input.isAdmin ?? userCountRow.count === 0;
  const createdAt = Date.now();
  const insertResult = database
    .prepare(
      `INSERT INTO users (
        name, username, password_hash, is_admin, created_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.username,
      input.passwordHash,
      isAdmin ? 1 : 0,
      createdAt
    );

  return {
    id: Number(insertResult.lastInsertRowid),
    name: input.name,
    username: input.username,
    passwordHash: input.passwordHash,
    isAdmin,
    createdAt,
    avatarPath: null,
    isDisabled: false,
    lastLoginAt: null,
  };
}

export async function getUserCount() {
  const database = await getDb();
  const row = database.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };

  return row.count;
}

export async function getActiveAdminCount() {
  const database = await getDb();
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND is_disabled = 0")
    .get() as { count: number };

  return row.count;
}

export async function updateUserName(userId: number, name: string) {
  const database = await getDb();
  database.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const database = await getDb();
  database
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, userId);
}

export async function updateUserDisabled(userId: number, disabled: boolean) {
  const database = await getDb();
  database
    .prepare("UPDATE users SET is_disabled = ? WHERE id = ?")
    .run(disabled ? 1 : 0, userId);
}

export async function recordUserLogin(userId: number) {
  const database = await getDb();
  database
    .prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .run(Date.now(), userId);
}

export async function updateUserAvatarPath(userId: number, avatarPath: string) {
  const database = await getDb();
  database
    .prepare("UPDATE users SET avatar_path = ? WHERE id = ?")
    .run(avatarPath, userId);
}

export async function getAdminUsers() {
  const database = await getDb();
  const rows = database
    .prepare(
      `WITH user_storage AS (
        SELECT owner_user_id, SUM(size) AS storage_bytes
        FROM (
          SELECT owner_user_id, stored_name, MAX(size) AS size
          FROM files
          WHERE owner_user_id IS NOT NULL
          GROUP BY owner_user_id, stored_name
        )
        GROUP BY owner_user_id
      )
       SELECT
        users.*,
        COUNT(files.id) AS share_count,
        COALESCE(user_storage.storage_bytes, 0) AS storage_bytes
       FROM users
       LEFT JOIN files ON files.owner_user_id = users.id
       LEFT JOIN user_storage ON user_storage.owner_user_id = users.id
       GROUP BY users.id
       ORDER BY users.created_at DESC`
    )
    .all() as Array<UserRow & { share_count: number; storage_bytes: number }>;

  return rows.map((row) => {
    const user = rowToUser(row);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      avatarPath: user.avatarPath,
      isDisabled: user.isDisabled,
      lastLoginAt: user.lastLoginAt,
      shareCount: row.share_count,
      storageBytes: row.storage_bytes,
    };
  }) satisfies AdminUserRecord[];
}
