import { supabase } from "./supabase";
import { readCloud, saveCloud } from "./cloud";
import { emptyState, State, validateState } from "./domain";
const key = "pond-companion-local-v1";
export async function loadLocal(): Promise<State> {
  const raw = localStorage.getItem(key);
  return raw
    ? validateState(JSON.parse(raw))
    : JSON.parse(JSON.stringify(emptyState));
}
export async function saveLocal(s: State) {
  localStorage.setItem(key, JSON.stringify(s));
}

export async function load(): Promise<State> {
  return supabase ? readCloud() : loadLocal();
}
export async function save(s: State): Promise<State> {
  if (supabase) return saveCloud(s);
  await saveLocal(s);
  return s;
}
