import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { supabase } from "./supabase";
import { Language, Kind } from "./domain";
import { translate } from "./i18n";
import { trashWords } from "./trashWords";
type Deleted = {
  id: string;
  kind: Kind;
  date: string;
  pond: string;
  product: string;
  notes: string;
  deleted_at: string;
};
export function Trash({
  org,
  language,
  restore,
}: {
  org: string;
  language: Language;
  restore: (id: string) => Promise<boolean>;
}) {
  const w = trashWords(language),
    [rows, setRows] = useState<Deleted[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    supabase!.rpc("entry_trash_list", { org }).then(({ data, error }) => {
      if (alive) {
        if (error) setError(w.error);
        else setRows(data);
        setBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [org, w.error]);
  return (
    <View style={{ gap: 14 }}>
      <Text>{w.help}</Text>
      {busy && <ActivityIndicator />}
      {error ? (
        <Text accessibilityRole="alert">{error}</Text>
      ) : !busy && !rows.length ? (
        <Text>{w.empty}</Text>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={{
            padding: 16,
            borderWidth: 1,
            borderColor: "#cedbce",
            borderRadius: 16,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "600" }}>
            {translate(language, row.kind)}
          </Text>
          <Text>
            {row.pond} · {row.date}
          </Text>
          {!!row.product && <Text>{row.product}</Text>}
          {!!row.notes && <Text>{row.notes}</Text>}
          <Text>
            {w.date}: {row.deleted_at.slice(0, 10)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={w.restore}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                if (await restore(row.id))
                  setRows(rows.filter((r) => r.id !== row.id));
              } finally {
                setBusy(false);
              }
            }}
            style={{
              padding: 16,
              backgroundColor: "#205e45",
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "white", fontSize: 18 }}>{w.restore}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
