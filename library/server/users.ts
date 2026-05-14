import { getDb } from "@/library/server/storage";

type UserRow = {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
  avatar_path: string | null;
};

export type User = {
  id: number;
  name: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: number;
  avatarPath: string | null;
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
  const isAdmin = userCountRow.count === 0;
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
  };
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

export async function updateUserAvatarPath(userId: number, avatarPath: string) {
  const database = await getDb();
  database
    .prepare("UPDATE users SET avatar_path = ? WHERE id = ?")
    .run(avatarPath, userId);
}
