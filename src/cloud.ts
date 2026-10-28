import { refreshReminders } from "./reminders";
import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { supabase, rememberLanguage } from "./supabase";
import { State, Language, emptyState } from "./domain";
import { decodeFarm, encodeChanges } from "./cloudMapping";
export type CloudContext = {
  org: string;
  role: "admin" | "worker";
  userId: string;
};
let context: CloudContext | null = null;
let baseline: State | null = null;
let language: Language | null = "en";
export const cloudContext = () => context;
export function selectFarm(
  c: CloudContext | null,
  lang: Language | null = "en",
) {
  if (context?.org !== c?.org || context?.userId !== c?.userId)
    void refreshReminders(emptyState).catch(() => {});
  context = c;
  baseline = null;
  language = lang;
}
export async function readCloud(): Promise<State> {
  if (!context || !supabase) throw Error("Sign in required");
  const current = context;
  const { data, error } = await supabase.rpc("farm_read", { org: current.org });
  if (error) throw error;
  if (context !== current) throw Error("Account changed");
  context.role = data.role;
  baseline = decodeFarm(data, language);
  return JSON.parse(JSON.stringify(baseline));
}
export async function saveCloud(next: State): Promise<State> {
  if (!context || !supabase || !baseline) throw Error("Sign in required");
  const current = context;
  const uploaded: State = JSON.parse(JSON.stringify(next));
  for (const [items, kind] of [
    [uploaded.entries, "entries"],
    [uploaded.expenses || [], "expenses"],
  ] as const) {
    for (const e of items)
      for (const a of e.attachments) {
        if (a.uri.startsWith("cloud:")) continue;
        const path =
          current.org +
          "/" +
          kind +
          "/" +
          (kind === "entries" ? e.pondId + "/" : "") +
          Crypto.randomUUID();
        let bytes: Uint8Array;
        if (Platform.OS === "web")
          bytes = new Uint8Array(await (await fetch(a.uri)).arrayBuffer());
        else {
          const b = atob(
            await FS.readAsStringAsync(a.uri, {
              encoding: FS.EncodingType.Base64,
            }),
          );
          bytes = Uint8Array.from(b, (c) => c.charCodeAt(0));
        }
        if (bytes.length > 20 * 1024 * 1024) throw Error("File exceeds 20 MB");
        const { error } = await supabase.storage
          .from("pond-documents")
          .upload(path, bytes.buffer as ArrayBuffer, {
            contentType: a.mime,
            upsert: false,
          });
        if (error) throw error;
        a.uri = "cloud:" + path;
      }
  }
  const changes = encodeChanges(baseline, uploaded, Crypto.randomUUID);
  const hasChanges = Object.entries(changes).some(
    ([k, v]) => k === "name" || v.length > 0,
  );
  if (hasChanges) {
    const { data, error } = await supabase.rpc("farm_save", {
      org: current.org,
      expected_revision: baseline.revision,
      changes,
    });
    if (error) throw error;
    uploaded.revision = Number(data);
  } else uploaded.revision = baseline.revision;
  if (context !== current) throw Error("Account changed");
  language = uploaded.language;
  if (language) void rememberLanguage(language).catch(() => {});
  baseline = uploaded;
  return JSON.parse(JSON.stringify(uploaded));
}
export async function resolveCloudFile(uri: string): Promise<string> {
  if (!uri.startsWith("cloud:")) return uri;
  if (!context || !supabase) throw Error("Sign in required");
  const { data, error } = await supabase.storage
    .from("pond-documents")
    .createSignedUrl(uri.slice(6), 60);
  if (error) throw error;
  return data.signedUrl;
}
