import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | undefined;
let schemaReady: Promise<void> | undefined;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Turso ist nicht vollständig konfiguriert.");
    client = createClient({ url, authToken });
  }
  return client;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getDb().execute(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    })();
  }
  return schemaReady;
}
