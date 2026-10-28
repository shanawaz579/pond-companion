import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { Language, Pond } from "./domain";
import { supabase } from "./supabase";
import { teamWords } from "./teamWords";
type Worker = { id: string; name: string; ponds: string[] };
type Invite = {
  id: string;
  worker_name: string;
  code: string;
  pond_ids: string[];
  expires_at: string;
};
export function Team({
  org,
  ponds,
  language,
  onChanged,
}: {
  org: string;
  ponds: Pond[];
  language: Language;
  onChanged: () => Promise<void>;
}) {
  const w = teamWords(language);
  const [data, setData] = useState<{ workers: Worker[]; invites: Invite[] }>({
    workers: [],
    invites: [],
  });
  const [edit, setEdit] = useState<Worker | null>(null),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState("");
  const refresh = async () => {
    const { data, error } = await supabase!.rpc("team_read", { org });
    if (error) throw error;
    setData(data);
  };
  useEffect(() => {
    let live = true;
    supabase!.rpc("team_read", { org }).then(({ data, error }) => {
      if (live) {
        if (error) setMessage(w.error);
        else setData(data);
      }
    });
    return () => {
      live = false;
    };
  }, [org, w.error]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      await onChanged();
    } catch {
      setMessage(w.error);
    } finally {
      setBusy(false);
    }
  };
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase!.rpc(fn, args);
    if (error) throw error;
  };
  const button = (label: string, fn: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={fn}
      style={{
        backgroundColor: "#205e45",
        padding: 16,
        borderRadius: 16,
        marginVertical: 6,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
  const names = (ids: string[]) =>
    ids
      .map((id) => ponds.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ") || w.noAccess;
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{w.team}</Text>
      {busy && <ActivityIndicator />}
      {message && <Text accessibilityRole="alert">{message}</Text>}
      {!adding &&
        !edit &&
        button(w.add, () => {
          setAdding(true);
          setName("");
          setSelected([]);
        })}
      {(adding || edit) && (
        <View style={{ gap: 10 }}>
          <Text>{edit ? edit.name : w.name}</Text>
          {adding && (
            <TextInput
              accessibilityLabel={w.name}
              value={name}
              onChangeText={setName}
              maxLength={100}
              style={{ borderWidth: 1, padding: 14, borderRadius: 12 }}
            />
          )}
          <Text>{w.ponds}</Text>
          {!ponds.length && <Text>{w.noPonds}</Text>}
          {ponds.map((p) => (
            <View
              key={p.id}
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text>{p.name}</Text>
              <Switch
                accessibilityLabel={p.name}
                value={selected.includes(p.id)}
                onValueChange={(v) =>
                  setSelected(
                    v
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />
            </View>
          ))}
          {button(edit ? w.save : w.invite, () => {
            if (adding && (!name.trim() || !selected.length)) {
              setMessage(w.select);
              return;
            }
            void run(async () => {
              await call(
                edit ? "set_worker" : "create_worker_invite",
                edit
                  ? { org, worker: edit.id, ponds: selected }
                  : { org, worker_name: name.trim(), ponds: selected },
              );
              setAdding(false);
              setEdit(null);
            });
          })}
          {button(w.cancel, () => {
            setAdding(false);
            setEdit(null);
          })}
        </View>
      )}
      <Text style={{ fontSize: 20, fontWeight: "600" }}>{w.workers}</Text>
      {!data.workers.length && <Text>{w.none}</Text>}
      {data.workers.map((person) => (
        <View
          key={person.id}
          style={{
            padding: 14,
            borderWidth: 1,
            borderColor: "#cedbce",
            borderRadius: 16,
          }}
        >
          <Text style={{ fontSize: 20 }}>{person.name}</Text>
          <Text>{names(person.ponds)}</Text>
          {button(w.edit, () => {
            setEdit(person);
            setSelected(person.ponds);
            setAdding(false);
          })}
          {confirm === person.id ? (
            <>
              {button(
                w.confirm,
                () =>
                  void run(async () => {
                    await call("remove_worker", { org, worker: person.id });
                    setConfirm("");
                  }),
              )}
              {button(w.cancel, () => setConfirm(""))}
            </>
          ) : (
            button(w.remove, () => setConfirm(person.id))
          )}
        </View>
      ))}
      {!!data.invites.length && (
        <Text style={{ fontSize: 20, fontWeight: "600" }}>{w.pending}</Text>
      )}
      {data.invites.map((invite) => (
        <View
          key={invite.id}
          style={{
            padding: 14,
            borderWidth: 1,
            borderColor: "#cedbce",
            borderRadius: 16,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 20 }}>{invite.worker_name}</Text>
          <Text>{names(invite.pond_ids)}</Text>
          <Text selectable style={{ fontSize: 23, fontWeight: "700" }}>
            {invite.code.match(/.{1,4}/g)?.join("-")}
          </Text>
          <Text>{w.help}</Text>
          <Text>
            {w.expires}: {invite.expires_at.slice(0, 10)}
          </Text>
          {button(
            w.revoke,
            () =>
              void run(() =>
                call("revoke_worker_invite", { org, invitation: invite.id }),
              ),
          )}
        </View>
      ))}
    </View>
  );
}
