import { getDb } from "@/library/server/storage";

const publicRegistrationKey = "public_registration_enabled";

export async function isPublicRegistrationEnabled() {
  const database = await getDb();
  const row = database
    .prepare("SELECT value FROM settings WHERE key = ? LIMIT 1")
    .get(publicRegistrationKey) as { value: string } | undefined;

  return row ? row.value === "true" : true;
}

export async function setPublicRegistrationEnabled(enabled: boolean) {
  const database = await getDb();

  database
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(publicRegistrationKey, enabled ? "true" : "false", Date.now());
}
