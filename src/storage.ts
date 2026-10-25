import * as SQLite from 'expo-sqlite';
import { emptyState, State, validateState } from './domain';
let database:Promise<SQLite.SQLiteDatabase>|undefined;
async function db(){if(!database)database=SQLite.openDatabaseAsync('pond-companion.db').then(async d=>{await d.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);');return d;});return database;}
export async function load():Promise<State>{const d=await db();const row=await d.getFirstAsync<{json:string}>('SELECT json FROM app_state WHERE id=1');return row?validateState(JSON.parse(row.json)):structuredClone(emptyState);}
export async function save(s:State){const d=await db();await d.runAsync('INSERT INTO app_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',JSON.stringify(s));}
