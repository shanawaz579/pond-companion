import { supabase } from "./supabase";
import { readCloud, saveCloud } from "./cloud";
import * as SQLite from "expo-sqlite";
import { emptyState, State, validateState } from "./domain";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = SQLite.openDatabaseAsync("pond-companion.db").then(async (d) => {
      await d.execAsync(
        "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);",
      );
      return d;
    });
  return database;
}
export async function loadLocal(): Promise<State> {
  const d = await db();
  const row = await d.getFirstAsync<{ json: string }>(
    "SELECT json FROM app_state WHERE id=1",
  );
  return row
    ? validateState(JSON.parse(row.json))
    : JSON.parse(JSON.stringify(emptyState));
}
export async function saveLocal(s: State) {
  const d = await db();
  await d.runAsync(
    "INSERT INTO app_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
    JSON.stringify(s),
  );
}

export async function load(): Promise<State> {
  return supabase ? readCloud() : loadLocal();
}
export async function save(s: State): Promise<State> {
  if (supabase) return saveCloud(s);
  await saveLocal(s);
  return s;
}
