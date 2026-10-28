import { resolveCloudFile } from "./cloud";
import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { zipSync, strToU8 } from "fflate";
import { Attachment, State } from "./domain";
export const id = () => Crypto.randomUUID();
function toBytes(s: string) {
  const b = atob(s);
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function toBase64(b: Uint8Array) {
  let str = "";
  for (let i = 0; i < b.length; i += 8192)
    str += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(str);
}
export async function retainFile(
  uri: string,
  name: string,
  mime: string,
): Promise<Attachment> {
  const key = id();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { id: key, uri: data, name, mime };
  }
  const folder = FS.documentDirectory + "attachments/";
  await FS.makeDirectoryAsync(folder, { intermediates: true });
  const ext =
    mime === "application/pdf"
      ? ".pdf"
      : mime === "image/png"
        ? ".png"
        : ".jpg";
  const dest = folder + key + ext;
  await FS.copyAsync({ from: uri, to: dest });
  return { id: key, uri: dest, name, mime };
}
export async function openFile(a: Attachment) {
  const uri = await resolveCloudFile(a.uri);
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw Error("shareUnavailable");
  let localUri = uri;
  if (a.uri.startsWith("cloud:")) {
    const downloaded = await FS.downloadAsync(
      uri,
      FS.cacheDirectory +
        "cloud-" +
        a.id +
        (a.mime === "application/pdf" ? ".pdf" : ".jpg"),
    );
    if (downloaded.status !== 200) throw Error("readError");
    localUri = downloaded.uri;
  }
  try {
    await Sharing.shareAsync(localUri, { mimeType: a.mime });
  } finally {
    if (a.uri.startsWith("cloud:"))
      await FS.deleteAsync(localUri, { idempotent: true });
  }
}
export async function exportBackup(state: State) {
  const files: Record<string, Uint8Array> = {};
  const backup: State = JSON.parse(JSON.stringify(state));
  for (const e of [...backup.entries, ...(backup.expenses || [])])
    for (const a of e.attachments) {
      const ext =
        a.mime === "application/pdf"
          ? ".pdf"
          : a.mime === "image/png"
            ? ".png"
            : ".jpg";
      const path = "attachments/" + a.id + ext;
      if (Platform.OS === "web" || a.uri.startsWith("cloud:"))
        files[path] = new Uint8Array(
          await (await fetch(await resolveCloudFile(a.uri))).arrayBuffer(),
        );
      else
        files[path] = toBytes(
          await FS.readAsStringAsync(a.uri, {
            encoding: FS.EncodingType.Base64,
          }),
        );
      a.uri = path;
    }
  files["records.json"] = strToU8(JSON.stringify(backup, null, 2));
  files["README.txt"] = strToU8(
    "Pond Companion backup v1. records.json contains your records. Attachment paths are relative to this ZIP. Keep this private. A restore interface is not yet available.",
  );
  const zip = zipSync(files, { level: 0 });
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(zip)], { type: "application/zip" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pond-backup.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const path = FS.cacheDirectory + "pond-backup-" + Date.now() + ".zip";
    await FS.writeAsStringAsync(path, toBase64(zip), {
      encoding: FS.EncodingType.Base64,
    });
    if (!(await Sharing.isAvailableAsync())) throw Error("shareUnavailable");
    await Sharing.shareAsync(path, { mimeType: "application/zip" });
  }
}
