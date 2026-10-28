import { Trash } from "./src/Trash";
import { trashWords } from "./src/trashWords";
import { Team } from "./src/Team";
import { teamWords } from "./src/teamWords";
import { DateField } from "./src/DateField";
import { CloudGate, words, useFarmNavigation } from "./src/CloudGate";
import { cloudContext, resolveCloudFile } from "./src/cloud";
import { supabase } from "./src/supabase";
import {
  batchLedger,
  expenseLedger,
  validateExpense,
  validateRemoval,
} from "./src/operations";
import { SpeciesSelect } from "./src/SpeciesSelect";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  activeCycle,
  FarmExpense,
  assertEntry,
  Attachment,
  cropTotals,
  feedWeightKg,
  feedProductOptions,
  lastFeedDefaults,
  speciesBalances,
  speciesOptions,
  speciesKey,
  harvestWeightKg,
  emptyState,
  Entry,
  isDate,
  Kind,
  numberValue,
  parameters,
  Pond,
  reportDue,
  State,
  today,
  units,
} from "./src/domain";
import { Key, languages, translate } from "./src/i18n";
import { load, save, loadLocal } from "./src/storage";
import { exportBackup, id, openFile, retainFile } from "./src/files";
import { refreshReminders } from "./src/reminders";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Draft = Record<string, string>;
const kinds: { key: Kind; icon: Icon }[] = [
  { key: "feed", icon: "nutrition-outline" },
  { key: "treatment", icon: "medkit-outline" },
  { key: "water", icon: "water-outline" },
  { key: "observation", icon: "eye-outline" },
  { key: "expense", icon: "wallet-outline" },
  { key: "growth", icon: "trending-up-outline" },
  { key: "harvest", icon: "fish-outline" },
];
function Button({
  label,
  onPress,
  icon,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: Icon;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon && (
        <Ionicons
          accessible={false}
          aria-hidden={true}
          name={icon}
          size={22}
          color={primary ? "#fff" : "#205e45"}
        />
      )}
      <Text style={[styles.buttonText, primary && { color: "#fff" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.small}>{hint}</Text>}
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        autoCorrect={!numeric}
        placeholder={numeric ? "0" : undefined}
        placeholderTextColor="#728378"
      />
    </View>
  );
}
function AttachmentImage({ uri }: { uri: string }) {
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    let active = true;
    resolveCloudFile(uri)
      .then((v) => {
        if (active) setResolved(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uri]);
  return resolved ? (
    <Image
      source={{ uri: resolved }}
      style={styles.photo}
      accessibilityLabel="Photo"
    />
  ) : (
    <ActivityIndicator />
  );
}
function AppContent() {
  const chooseFarm = useFarmNavigation();
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState<string | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [state, setState] = useState<State>(emptyState),
    [loaded, setLoaded] = useState(false),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [screen, setScreen] = useState("today"),
    [pondId, setPondId] = useState(""),
    [draft, setDraft] = useState<Draft>({}),
    [kind, setKind] = useState<Kind>("feed"),
    [attachments, setAttachments] = useState<Attachment[]>([]),
    [readings, setReadings] = useState<Draft>({}),
    [report, setReport] = useState(false),
    [pending, setPending] = useState<Entry | null>(null),
    [pendingExpense, setPendingExpense] = useState<FarmExpense | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState(""),
    [detail, setDetail] = useState<Entry | null>(null);
  const lock = useRef(false),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const cloud = cloudContext();
  const admin = !supabase || cloud?.role === "admin";
  const cw = words(state.language);
  const t = (k: Key) => {
    if (supabase) {
      if (k === "save") return cw.save;
      if (k === "saved" || k === "noteSaved") return cw.saved;
      if (["localOnly", "localExplanation", "privacy"].includes(k))
        return cw.connected;
      if (k === "loadError") return cw.error;
    }
    return translate(state.language, k);
  };
  async function changeTrash(id: string, trashed: boolean): Promise<boolean> {
    if (!cloud || !admin || busy) return false;
    setBusy(true);
    setError("");
    const tw = trashWords(state.language);
    try {
      const { error } = await supabase!.rpc("set_entry_trashed", {
        org: cloud.org,
        entry: id,
        trashed,
        expected_revision: state.revision,
      });
      if (error) throw error;
      const updated = await load();
      setState(updated);
      await refreshReminders(updated).catch(() => {});
      setConfirmTrash(null);
      setToast(trashed ? tw.deleted : tw.restored);
      if (trashed) {
        setDetail(null);
        go("records");
      }
      return true;
    } catch (e: any) {
      setError(
        e?.message?.includes("FARM_CONFLICT")
          ? tw.conflict
          : e?.message?.includes("Stock count exceeded")
            ? tw.stock
            : tw.error,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const pond = state.ponds.find((p) => p.id === pondId);
  const cycle = activeCycle(state, pondId);
  const locale =
    state.language === "te"
      ? "te-IN"
      : state.language === "hi"
        ? "hi-IN"
        : "en-IN";
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  const read = () => {
    load()
      .then((s) => {
        setState(s);
        setLoaded(true);
        refreshReminders(s).catch(() => {});
      })
      .catch(() => setLoadFailed(true));
  };
  useEffect(read, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (s: string) => {
    setError("");
    setScreen(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = () => {
    if (busy) return true;
    if (
      ["entry", "pondForm", "cropForm", "stockForm", "expenseForm"].includes(
        screen,
      )
    ) {
      const leave = () =>
        go(screen === "expenseForm" ? "expenses" : pond ? "pond" : "today");
      if (Platform.OS === "web") {
        if (window.confirm(t("deleteDraft"))) leave();
      } else
        Alert.alert(t("deleteDraft"), "", [
          { text: t("keep"), style: "cancel" },
          { text: t("discard"), onPress: leave },
        ]);
    } else if (screen === "expenseReview") go("expenseForm");
    else if (screen === "expenses") go("today");
    else if (screen === "review") go("entry");
    else if (screen === "entryDetail") go("records");
    else if (screen === "pond") go("today");
    else if (screen === "settings" && trashOpen) setTrashOpen(false);
    else if (screen === "settings" && teamOpen) setTeamOpen(false);
    else if (screen === "settings") go("today");
    else return false;
    return true;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", back);
    return () => sub.remove();
  });
  async function commit(next: State, after?: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = { ...next, revision: state.revision + 1 };
      const persisted = await save(updated);
      setState(persisted);
      setToast(cloud ? cw.saved : translate(updated.language, "saved"));
      after?.();
      refreshReminders(updated).catch(() => {});
    } catch (e: any) {
      setError(
        e?.message?.includes("FARM_CONFLICT")
          ? cw.conflict
          : cloud
            ? cw.error
            : t("error"),
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const change = (k: string, v: string) =>
    setDraft((d) => ({
      ...d,
      [k]: v,
      ...(k === "category" && v !== d.category ? { species: "" } : {}),
    }));
  const field = (
    key: string,
    label: Key,
    numeric = false,
    optional = false,
    hint?: Key,
  ) =>
    key === "date" ? (
      <DateField
        label={t(label)}
        value={draft.date || today()}
        onChange={(v) => change("date", v)}
        language={state.language}
        disabled={busy}
        minimum={
          screen === "stockForm" || screen === "entry"
            ? cycle?.startDate
            : undefined
        }
      />
    ) : (
      <Field
        key={key}
        label={t(label) + (optional ? " · " + t("optional") : "")}
        value={draft[key] || ""}
        onChange={(v) => change(key, v)}
        numeric={numeric}
        hint={hint ? t(hint) : undefined}
      />
    );
  const choices = (
    key: string,
    options: { value: string; label: string }[],
  ) => (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: draft[key] === o.value }}
          aria-checked={draft[key] === o.value}
          onPress={() => change(key, o.value)}
          style={[styles.chip, draft[key] === o.value && styles.selected]}
        >
          <Text style={styles.chipText}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
  const heading = (title: string, sub?: string) => (
    <View style={{ marginBottom: 18 }}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {sub && <Text style={styles.subtitle}>{sub}</Text>}
    </View>
  );
  const context = () =>
    pond ? (
      <View style={styles.context}>
        <Text style={styles.cardTitle}>{pond.name}</Text>
        <Text style={styles.small}>{pond.location}</Text>
        {cycle && <Text style={styles.small}>{cycle.name}</Text>}
      </View>
    ) : null;
  const fail = (key: Key) => setError(t(key));
  const beginPond = (edit = false) => {
    setDraft(
      edit && pond
        ? {
            id: pond.id,
            name: pond.name,
            location: pond.location,
            area: String(pond.area),
            waterType: pond.waterType,
            interval: pond.reportInterval ? String(pond.reportInterval) : "",
          }
        : {
            name: "",
            location: "",
            area: "",
            waterType: "fresh",
            interval: "",
          },
    );
    go("pondForm");
  };
  function savePond() {
    const area = numberValue(draft.area || "");
    const interval = draft.interval?.trim()
      ? numberValue(draft.interval)
      : null;
    if (!draft.name?.trim() || !draft.location?.trim()) return fail("required");
    if (
      area === null ||
      (draft.interval?.trim() &&
        (interval === null || !Number.isInteger(interval) || interval > 365))
    )
      return fail("invalidNumber");
    const p: Pond = {
      id: draft.id || id(),
      name: draft.name.trim(),
      location: draft.location.trim(),
      area,
      waterType: draft.waterType === "brackish" ? "brackish" : "fresh",
      reportInterval: interval,
      createdAt: pond?.createdAt || new Date().toISOString(),
    };
    commit(
      {
        ...state,
        ponds: draft.id
          ? state.ponds.map((x) => (x.id === p.id ? p : x))
          : [...state.ponds, p],
      },
      () => {
        setPondId(p.id);
        go("pond");
      },
    );
  }
  function saveCrop() {
    if (!pond) return fail("required");
    if (!isDate(draft.date) || draft.date > today()) return fail("invalidDate");
    if (cycle) return fail("invalidCycle");
    const c = {
      id: id(),
      pondId,
      name: pond.name,
      startDate: draft.date,
    };
    commit({ ...state, cycles: [...state.cycles, c] }, () => go("pond"));
  }
  function saveStock() {
    if (!cycle) return fail("invalidCycle");
    if (!draft.species?.trim()) return fail("required");
    const count = numberValue(draft.count || ""),
      weight = numberValue(draft.weight || "0", true),
      cost = numberValue(draft.cost || "0", true);
    if (
      count === null ||
      !Number.isInteger(count) ||
      weight === null ||
      cost === null
    )
      return fail("invalidNumber");
    if (
      !isDate(draft.date) ||
      draft.date < cycle.startDate ||
      draft.date > today()
    )
      return fail("invalidDate");
    commit(
      {
        ...state,
        stocking: [
          ...state.stocking,
          {
            id: id(),
            cycleId: cycle.id,
            species: draft.species.trim(),
            category: draft.category === "prawn" ? "prawn" : "fish",
            date: draft.date,
            count,
            averageGrams: weight,
            seedCost: cost,
            supplier: draft.supplier?.trim() || "",
          },
        ],
      },
      () => go("pond"),
    );
  }
  function beginExpense() {
    setDraft({
      expensePond: "",
      category: "other",
      amount: "",
      date: today(),
      notes: "",
    });
    setAttachments([]);
    setPendingExpense(null);
    go("expenseForm");
  }
  function reviewExpense() {
    const amount = numberValue(draft.amount || "");
    if (amount === null) return fail("invalidNumber");
    const p = draft.expensePond || null;
    const matching = state.cycles
      .filter(
        (c) =>
          c.pondId === p &&
          c.startDate <= draft.date &&
          (!c.closedAt || draft.date <= c.closedAt.slice(0, 10)),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const e: FarmExpense = {
      id: id(),
      pondId: p,
      cycleId: matching?.id,
      category: draft.category || "other",
      date: draft.date,
      amount,
      notes: draft.notes?.trim() || "",
      attachments,
      createdAt: new Date().toISOString(),
    };
    try {
      validateExpense(state, e);
    } catch (err) {
      return fail((err as Error).message as Key);
    }
    setPendingExpense(e);
    go("expenseReview");
  }
  function beginEntry(k: Kind) {
    if (k === "expense") {
      beginExpense();
      return;
    }
    if (!cycle) return;
    setKind(k);
    const previous = lastFeedDefaults(state);
    setDraft({
      date: today(),
      unit: k === "growth" ? "g" : k === "feed" ? previous.unit : "kg",
      bagWeight: k === "feed" ? previous.bagWeight : "",
      quantity: "",
      harvestedCount: "",
      mortalityCount: "",
      countApproximate: "false",
      product: k === "feed" ? previous.product : "",
      cost: "",
      revenue: "",
      notes: "",
      species: "",
    });
    setReadings({});
    setAttachments([]);
    setReport(false);
    go("entry");
  }
  async function attach(source: "camera" | "gallery" | "document") {
    if (lock.current) return;
    setBusy(true);
    lock.current = true;
    try {
      const next: Attachment[] = [];
      if (source === "document") {
        const r = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (!r.canceled)
          for (const a of r.assets)
            next.push(
              await retainFile(a.uri, a.name, a.mimeType || "application/pdf"),
            );
      } else {
        if (source === "camera") {
          const p = await ImagePicker.requestCameraPermissionsAsync();
          if (!p.granted) {
            fail("permission");
            return;
          }
        }
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"],
          quality: 0.7,
          allowsMultipleSelection: source === "gallery",
        };
        const r =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        if (!r.canceled)
          for (const a of r.assets)
            next.push(
              await retainFile(
                a.uri,
                a.fileName || "photo-" + Date.now() + ".jpg",
                a.mimeType || "image/jpeg",
              ),
            );
      }
      setAttachments((a) => [...a, ...next]);
    } catch {
      fail("attachmentError");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function review() {
    if (!cycle) return fail("invalidCycle");
    const quantity = draft.quantity?.trim()
      ? numberValue(draft.quantity)
      : null;
    const count =
      kind === "harvest" && draft.harvestedCount?.trim()
        ? numberValue(draft.harvestedCount)
        : null;
    const deaths =
      kind === "observation" && draft.mortalityCount?.trim()
        ? numberValue(draft.mortalityCount)
        : null;
    if (
      (kind === "harvest" &&
        draft.harvestedCount?.trim() &&
        (count === null || !Number.isSafeInteger(count))) ||
      (kind === "observation" &&
        draft.mortalityCount?.trim() &&
        (deaths === null || !Number.isSafeInteger(deaths)))
    )
      return fail("invalidCount");
    const cost = numberValue(draft.cost || "0", true),
      revenue = numberValue(draft.revenue || "0", true);
    if (cost === null || revenue === null) return fail("amountZero");
    const parsed = [];
    for (const parameter of parameters) {
      if (!readings[parameter]?.trim()) continue;
      const value = numberValue(readings[parameter], true);
      if (value === null || (parameter === "ph" && value > 14))
        return fail("invalidReading");
      parsed.push({ parameter, value, unit: units[parameter] });
    }
    const e: Entry = {
      id: id(),
      pondId,
      cycleId: cycle.id,
      kind,
      date: draft.date,
      createdAt: new Date().toISOString(),
      product: draft.product?.trim() || "",
      quantity,
      ...(kind === "feed" && draft.unit === "bag"
        ? { bagWeightKg: numberValue(draft.bagWeight || "") ?? undefined }
        : {}),
      ...(kind === "harvest"
        ? {
            harvestedCount: count,
            countApproximate:
              count !== null && draft.countApproximate === "true",
          }
        : {}),
      ...(kind === "observation" ? { mortalityCount: deaths } : {}),
      unit: draft.unit || "kg",
      cost,
      revenue,
      species: draft.species || "",
      notes: draft.notes?.trim() || "",
      readings: parsed,
      attachments,
      report: kind === "water" && report,
    };
    try {
      assertEntry(state, e);
      if (
        (e.kind === "harvest" && e.harvestedCount != null) ||
        e.mortalityCount != null
      ) {
        validateRemoval(state, e);
      }
    } catch (e) {
      return fail((e as Error).message as Key);
    }
    setPending(e);
    go("review");
  }
  const fileList = (files: Attachment[], editable = false) => (
    <View style={{ gap: 10 }}>
      {files.map((a) => (
        <View key={a.id} style={styles.card}>
          {a.mime.startsWith("image/") && <AttachmentImage uri={a.uri} />}
          <Text style={styles.small}>{a.name}</Text>
          <View style={styles.wrap}>
            <Button
              label={t("open")}
              icon="open-outline"
              onPress={() => openFile(a).catch(() => fail("readError"))}
            />
            {editable && (
              <Button
                label={t("remove")}
                icon="trash-outline"
                onPress={() =>
                  setAttachments((xs) => xs.filter((x) => x.id !== a.id))
                }
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
  const summary = (e: Entry) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {state.ponds.find((p) => p.id === e.pondId)?.name}
      </Text>
      <Text style={styles.small}>
        {state.ponds.find((p) => p.id === e.pondId)?.location}
      </Text>
      <Text style={styles.section}>
        {t(e.kind)} · {e.date}
      </Text>
      {!!e.product && <Text style={styles.body}>{e.product}</Text>}
      {!!e.species && <Text style={styles.body}>{e.species}</Text>}
      {e.quantity !== null && (
        <Text style={styles.amount}>
          {e.quantity} {t(e.unit as Key) || e.unit}
        </Text>
      )}
      {e.kind === "feed" && e.unit === "bag" && (
        <Text style={styles.small}>
          {t("bagWeight")}: {e.bagWeightKg} · {t("totalFeedKg")}:{" "}
          {feedWeightKg(e).toLocaleString(locale)}
        </Text>
      )}
      {e.kind === "harvest" && (
        <>
          <Text style={styles.body}>
            {t("harvestedCount")}:{" "}
            {e.harvestedCount == null
              ? t("unknownCount")
              : `${e.countApproximate ? "≈ " : ""}${e.harvestedCount.toLocaleString(locale)}`}
          </Text>
          {e.harvestedCount != null && (
            <Text style={styles.small}>
              {t("averageHarvest")}: {e.countApproximate ? "≈ " : ""}
              {(harvestWeightKg(e) / e.harvestedCount).toLocaleString(locale, {
                maximumFractionDigits: 3,
              })}{" "}
              {t("kg")}
            </Text>
          )}
        </>
      )}
      {e.mortalityCount != null && (
        <Text style={styles.body}>
          {t("recordedDeaths")}: {e.mortalityCount}
        </Text>
      )}
      {admin && e.cost > 0 && (
        <Text style={styles.body}>
          {t("cost")}: {money(e.cost)}
        </Text>
      )}
      {admin && e.revenue > 0 && (
        <Text style={styles.body}>
          {t("sales")}: {money(e.revenue)}
        </Text>
      )}
      {!!e.notes && <Text style={styles.body}>{e.notes}</Text>}
      {e.readings.map((r) => (
        <Text key={r.parameter} style={styles.body}>
          {t(r.parameter)}: {r.value} {r.unit}
        </Text>
      ))}
      {e.report && <Text style={styles.badge}>{t("isReport")}</Text>}
    </View>
  );
  const entryList = (entries: Entry[]) =>
    entries.length ? (
      entries
        .slice()
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        )
        .map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => {
              setDetail(e);
              go("entryDetail");
            }}
            style={styles.card}
          >
            <View style={styles.between}>
              <Text style={styles.cardTitle}>{t(e.kind)}</Text>
              <Ionicons
                accessible={false}
                aria-hidden={true}
                name="chevron-forward"
                size={20}
                color="#205e45"
              />
            </View>
            <Text style={styles.small}>
              {state.ponds.find((p) => p.id === e.pondId)?.name} · {e.date}
            </Text>
            {!!e.product && <Text style={styles.body}>{e.product}</Text>}
            {e.quantity !== null && (
              <Text style={styles.body}>
                {e.quantity} {t(e.unit as Key) || e.unit}
              </Text>
            )}
            {e.attachments.length > 0 && (
              <Text style={styles.small}>
                {t("attachments")}: {e.attachments.length}
              </Text>
            )}
          </Pressable>
        ))
    ) : (
      <Text style={styles.subtitle}>{t("emptyRecords")}</Text>
    );
  function reportLabel(p: Pond) {
    const r = reportDue(state, p);
    if (r && !r.last)
      return `${t("noReport")} · ${t("reportInterval")}: ${p.reportInterval}`;
    return r
      ? (r.overdueDays ?? 0) > 0
        ? `${t("reportDue")} · ${r.overdueDays} ${t("overdue")}`
        : r.overdueDays === 0
          ? `${t("reportDue")} · ${t("today")}`
          : `${t("nextReport")}: ${r.due}`
      : t("noSchedule");
  }
  const expenseSummary = (e: FarmExpense) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {e.pondId
          ? state.ponds.find((p) => p.id === e.pondId)?.name
          : t("wholeFarm")}
      </Text>
      <Text style={styles.body}>
        {t(e.category as Key)} · {e.date}
      </Text>
      <Text style={styles.amount}>{money(e.amount)}</Text>
      {!!e.notes && <Text style={styles.body}>{e.notes}</Text>}
    </View>
  );
  const allocationView = (e: Entry) => {
    if (e.kind !== "harvest") return null;
    const result = batchLedger(
      {
        ...state,
        entries: state.entries.some((x) => x.id === e.id)
          ? state.entries
          : [...state.entries, e],
      },
      e.cycleId,
    );
    return (
      <View style={styles.context}>
        <Text style={styles.cardTitle}>{t("allocation")}</Text>
        <Text style={styles.small}>{t("fifoHelp")}</Text>
        {e.harvestedCount == null ? (
          <Text style={styles.notice}>{t("noAllocation")}</Text>
        ) : (
          result.allocations
            .filter((a) => a.entryId === e.id)
            .map((a) => (
              <Text key={a.batchId} style={styles.body}>
                {state.stocking.find((b) => b.id === a.batchId)?.date}:{" "}
                {a.approximate ? "≈ " : ""}
                {a.count.toLocaleString(locale)}
              </Text>
            ))
        )}
        {result.discrepancies.some((d) => d.entryId === e.id) && (
          <Text style={styles.error}>{t("removalExceeds")}</Text>
        )}
      </View>
    );
  };
  let body: React.ReactNode;
  if (!loaded)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {loadFailed ? (
            <>
              <Text style={styles.body}>{t("loadError")}</Text>
              <Button label={t("retry")} onPress={read} />
            </>
          ) : (
            <ActivityIndicator size="large" color="#205e45" />
          )}
        </View>
      </SafeAreaView>
    );
  if (!state.language)
    body = (
      <>
        <View style={styles.heroIcon}>
          <Ionicons
            accessible={false}
            aria-hidden={true}
            name="water"
            size={40}
            color="#205e45"
          />
        </View>
        {heading("Welcome / స్వాగతం / स्वागत", "Choose your language")}
        <Text style={styles.subtitle}>తెలుగు · English · हिन्दी</Text>
        {languages.map((l) => (
          <Button
            key={l.id}
            label={l.name}
            disabled={busy}
            onPress={() => commit({ ...state, language: l.id })}
          />
        ))}
      </>
    );
  else if (screen === "today" || screen === "ponds")
    body = (
      <>
        {heading(
          screen === "today" ? t("enterFarm") : t("ponds"),
          state.farmName || t("setup"),
        )}
        {admin && (
          <Button
            label={t("expenses")}
            icon="wallet-outline"
            onPress={() => {
              setFilter("");
              go("expenses");
            }}
          />
        )}
        {admin && cloud && (
          <Button
            label={teamWords(state.language).team}
            onPress={() => {
              setTeamOpen(true);
              go("settings");
            }}
          />
        )}
        {!state.ponds.length ? (
          <View style={styles.empty}>
            <Ionicons
              accessible={false}
              aria-hidden={true}
              name="water-outline"
              size={46}
              color="#205e45"
            />
            <Text style={styles.section}>{t("getStarted")}</Text>
            <Text style={styles.subtitle}>{t("emptyPonds")}</Text>
          </View>
        ) : (
          state.ponds.map((p) => {
            const c = activeCycle(state, p.id);
            const species = Array.from(
              new Set(
                state.stocking
                  .filter((s) => s.cycleId === c?.id)
                  .map((s) => s.species),
              ),
            );
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={p.name + ", " + p.location}
                style={styles.pondCard}
                onPress={() => {
                  setPondId(p.id);
                  go("pond");
                }}
              >
                <View style={styles.between}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <Ionicons
                    accessible={false}
                    aria-hidden={true}
                    name="arrow-forward"
                    size={22}
                    color="#205e45"
                  />
                </View>
                <View style={styles.inline}>
                  <Ionicons
                    accessible={false}
                    aria-hidden={true}
                    name="location-outline"
                    size={18}
                    color="#52665b"
                  />
                  <Text style={styles.small}>{p.location}</Text>
                </View>
                <Text style={styles.body}>
                  {p.area}{" "}
                  {state.language === "te"
                    ? "ఎకరాలు"
                    : state.language === "hi"
                      ? "एकड़"
                      : "acres"}{" "}
                  · {t(p.waterType)}
                </Text>
                <Text style={styles.small}>
                  {c ? species.join(", ") || t("needsStock") : t("noCrop")}
                </Text>
                {c && <Text style={styles.badge}>{reportLabel(p)}</Text>}
              </Pressable>
            );
          })
        )}
        {admin && (
          <Button
            label={t("addPond")}
            icon="add-circle-outline"
            primary
            onPress={() => beginPond()}
          />
        )}
      </>
    );
  else if (screen === "pond" && pond) {
    const totals = cycle ? cropTotals(state, cycle.id) : null;
    body = (
      <>
        {heading(pond.name, pond.location)}
        <Text style={styles.small}>
          {pond.area} {t("area").replace(/.*\(/, "").replace(")", "")}
        </Text>
        {cycle ? (
          <>
            <View style={styles.context}>
              <Text style={styles.cardTitle}>{cycle.name}</Text>
              <Text style={styles.small}>{cycle.startDate}</Text>
              <Text style={styles.badge}>{reportLabel(pond)}</Text>
            </View>
            <Text style={styles.small}>{t("periodHelp")}</Text>
            <Text style={styles.section}>{t("work")}</Text>
            <View style={styles.actionGrid}>
              {kinds
                .filter((k) => admin || !["expense", "harvest"].includes(k.key))
                .map((k) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(k.key)}
                    key={k.key}
                    style={styles.action}
                    onPress={() => beginEntry(k.key)}
                  >
                    <Ionicons
                      accessible={false}
                      aria-hidden={true}
                      name={k.icon}
                      size={28}
                      color="#205e45"
                    />
                    <Text style={styles.actionLabel}>{t(k.key)}</Text>
                  </Pressable>
                ))}
            </View>
            <Text style={styles.section}>{t("remainingStock")}</Text>
            {speciesBalances(state, cycle.id).map((b) => (
              <View key={b.species} style={styles.card}>
                <Text style={styles.cardTitle}>{b.species}</Text>
                <Text style={styles.body}>
                  {t("stockedCount")}: {b.stocked.toLocaleString(locale)}
                </Text>
                <Text style={styles.small}>
                  {t("recordedHarvestCount")}: {b.approximate ? "≈ " : ""}
                  {b.harvested.toLocaleString(locale)}
                </Text>
                <Text style={styles.small}>
                  {t("recordedDeaths")}: {b.deaths.toLocaleString(locale)}
                </Text>
                <Text
                  style={
                    b.incomplete || (b.remaining !== null && b.remaining < 0)
                      ? styles.notice
                      : styles.badge
                  }
                >
                  {b.incomplete
                    ? t("incompleteCount")
                    : b.remaining! < 0
                      ? t("countConflict")
                      : `${t("remainingCount")}: ≈ ${b.remaining!.toLocaleString(locale)}`}
                </Text>
              </View>
            ))}
            <Text style={styles.small}>{t("countBasis")}</Text>
            <Text style={styles.section}>{t("batches")}</Text>
            <Text style={styles.small}>{t("fifoHelp")}</Text>
            {batchLedger(state, cycle.id).batches.map((b) => (
              <View style={styles.card} key={b.stock.id}>
                <Text style={styles.cardTitle}>
                  {b.stock.species} · {b.stock.date}
                </Text>
                <Text style={styles.small}>
                  {t("stockedCount")}: {b.stock.count.toLocaleString(locale)} ·{" "}
                  {t("removedCount")}: {b.removed.toLocaleString(locale)}
                </Text>
                <Text style={styles.badge}>
                  {batchLedger(state, cycle.id).unknown.has(b.stock.species)
                    ? t("unknownBatch")
                    : `${t("batchRemaining")}: ${b.uncertain ? "≈ " : ""}${b.remaining.toLocaleString(locale)}`}
                </Text>
                <Text style={styles.small}>
                  {t("initialWeight")}: {b.stock.averageGrams || t("unknown")}
                </Text>
                {admin && (
                  <Text style={styles.small}>
                    {t("seedCost")}: {money(b.stock.seedCost)}
                  </Text>
                )}
              </View>
            ))}
            {admin && (
              <Button
                label={t("addStock")}
                icon="add"
                onPress={() => {
                  setDraft({ category: "fish", date: today() });
                  go("stockForm");
                }}
              />
            )}
            <Text style={styles.section}>{t("crop")}</Text>
            <View style={styles.card}>
              {(admin
                ? [
                    ["totalCost", totals!.costs],
                    ["sales", totals!.revenue],
                    ["balance", totals!.balance],
                  ]
                : []
              ).map(([k, n]) => (
                <View key={k} style={styles.between}>
                  <Text style={styles.body}>{t(k as Key)}</Text>
                  <Text style={styles.cardTitle}>{money(n as number)}</Text>
                </View>
              ))}
              <Text style={styles.small}>{t("balanceHelp")}</Text>
            </View>
            <Text style={styles.section}>{t("history")}</Text>
            {entryList(
              state.entries.filter((e) => e.cycleId === cycle.id).slice(-5),
            )}
            {admin && (
              <Button
                label={t("closeCrop")}
                onPress={() => {
                  const close = () =>
                    commit({
                      ...state,
                      cycles: state.cycles.map((c) =>
                        c.id === cycle.id
                          ? { ...c, closedAt: new Date().toISOString() }
                          : c,
                      ),
                    });
                  if (Platform.OS === "web") {
                    if (window.confirm(t("closeWarning"))) close();
                  } else
                    Alert.alert(t("closeCrop"), t("closeWarning"), [
                      { text: t("cancel"), style: "cancel" },
                      { text: t("confirm"), onPress: close },
                    ]);
                }}
              />
            )}
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{t("noCrop")}</Text>
            {admin && (
              <Button
                label={t("startCrop")}
                primary
                onPress={() => {
                  setDraft({ date: today() });
                  go("cropForm");
                }}
              />
            )}
          </>
        )}
        {admin && (
          <Button
            label={t("editPond")}
            icon="create-outline"
            onPress={() => beginPond(true)}
          />
        )}
        {state.cycles.some((c) => c.pondId === pond.id && c.closedAt) && (
          <>
            <Text style={styles.section}>{t("cropHistory")}</Text>
            {state.cycles
              .filter((c) => c.pondId === pond.id && c.closedAt)
              .map((c) => (
                <View key={c.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{c.name}</Text>
                  <Text style={styles.small}>
                    {t("closed")} · {c.startDate}
                  </Text>
                  {entryList(state.entries.filter((e) => e.cycleId === c.id))}
                </View>
              ))}
          </>
        )}
      </>
    );
  } else if (screen === "pondForm")
    body = (
      <>
        {heading(t(draft.id ? "editPond" : "addPond"), t("setup"))}
        {field("name", "pondName")}
        {field("location", "location")}
        {field("area", "area", true)}
        <Text style={styles.label}>{t("waterType")}</Text>
        {choices("waterType", [
          { value: "fresh", label: t("fresh") },
          { value: "brackish", label: t("brackish") },
        ])}
        {field("interval", "reportInterval", true, true, "intervalHelp")}
        <Button label={t("save")} disabled={busy} primary onPress={savePond} />
      </>
    );
  else if (screen === "cropForm")
    body = (
      <>
        {heading(t("startCrop"))}
        {context()}
        {field("date", "startDate")}
        <Button label={t("save")} primary disabled={busy} onPress={saveCrop} />
      </>
    );
  else if (screen === "stockForm")
    body = (
      <>
        {heading(t("addStock"), t("stockEmpty"))}
        {context()}
        {choices("category", [
          { value: "fish", label: t("fish") },
          { value: "prawn", label: t("prawn") },
        ])}
        <SpeciesSelect
          key={draft.category + ":" + (draft.species || "")}
          value={draft.species || ""}
          options={speciesOptions(
            state,
            draft.category === "prawn" ? "prawn" : "fish",
          )}
          t={t}
          disabled={busy}
          onSelect={(v) => change("species", v)}
          onCreate={(name) => {
            const category = draft.category === "prawn" ? "prawn" : "fish";
            const existing = speciesOptions(state, category).find(
              (n) => speciesKey(n) === speciesKey(name),
            );
            if (existing) {
              change("species", existing);
              return;
            }
            commit(
              {
                ...state,
                speciesCatalog: [
                  ...(state.speciesCatalog || []),
                  { name, category },
                ],
              },
              () => change("species", name),
            );
          }}
        />
        {field("date", "stockDate")}
        {field("count", "count", true)}
        {field("weight", "averageGrams", true, true)}
        {field("cost", "seedCost", true, true)}
        {field("supplier", "supplier", false, true)}
        <Button label={t("save")} primary disabled={busy} onPress={saveStock} />
      </>
    );
  else if (screen === "entry")
    body = (
      <>
        {heading(t(kind))}
        {context()}
        {field("date", "date")}
        {["treatment", "expense"].includes(kind) &&
          field("product", "product", false, kind !== "treatment")}
        {["feed", "treatment", "harvest", "growth"].includes(kind) &&
          field(
            "quantity",
            kind === "growth"
              ? "averageWeight"
              : kind === "harvest"
                ? "harvestWeight"
                : "quantity",
            true,
          )}
        {kind === "harvest" && (
          <>
            <Text style={styles.label}>{t("unit")}</Text>
            {choices("unit", [
              { value: "kg", label: t("kg") },
              { value: "tonnes", label: t("tonnes") },
            ])}
            {field("harvestedCount", "harvestedCount", true, true, "countHelp")}
            <View style={styles.between}>
              <Text style={[styles.label, { flex: 1 }]}>
                {t("countApproximate")}
              </Text>
              <Switch
                accessibilityLabel={t("countApproximate")}
                value={draft.countApproximate === "true"}
                onValueChange={(v) => change("countApproximate", String(v))}
              />
            </View>
          </>
        )}
        {kind === "observation" &&
          field(
            "mortalityCount",
            "mortalityCount",
            true,
            true,
            "mortalityHelp",
          )}
        {kind === "feed" && (
          <>
            <Text style={styles.small}>{t("feedDefaults")}</Text>
            <Text style={styles.label}>{t("unit")}</Text>
            {choices("unit", [
              { value: "kg", label: t("kg") },
              { value: "bag", label: t("bag") },
            ])}
            <SpeciesSelect
              key={"feed:" + draft.product}
              value={draft.product || ""}
              options={feedProductOptions(state)}
              disabled={busy}
              t={(key) =>
                t(
                  (
                    {
                      species: "feedBrand",
                      searchSpecies: "searchFeed",
                      selectSpecies: "selectFeed",
                      createSpecies: "createFeed",
                      changeSpecies: "changeFeed",
                      speciesHelp: "feedHelp",
                    } as Partial<Record<Key, Key>>
                  )[key] || key,
                )
              }
              onSelect={(name) => {
                const previous = state.entries
                  .filter(
                    (e) =>
                      e.kind === "feed" &&
                      speciesKey(e.product) === speciesKey(name) &&
                      e.unit === "bag",
                  )
                  .at(-1);
                setDraft((d) => ({
                  ...d,
                  product: name,
                  bagWeight: previous?.bagWeightKg
                    ? String(previous.bagWeightKg)
                    : "",
                }));
              }}
              onCreate={(name) => {
                const match = feedProductOptions(state).find(
                  (n) => speciesKey(n) === speciesKey(name),
                );
                if (match) {
                  change("product", match);
                  return;
                }
                commit(
                  {
                    ...state,
                    feedProducts: [...(state.feedProducts || []), name],
                  },
                  () =>
                    setDraft((d) => ({ ...d, product: name, bagWeight: "" })),
                );
              }}
            />
            {draft.unit === "bag" && (
              <>
                {field("bagWeight", "bagWeight", true, false, "bagHelp")}
                {numberValue(draft.quantity || "") !== null &&
                  numberValue(draft.bagWeight || "") !== null && (
                    <Text style={styles.badge}>
                      {t("totalFeedKg")}:{" "}
                      {(
                        Number(draft.quantity) * Number(draft.bagWeight)
                      ).toLocaleString(locale)}
                    </Text>
                  )}
              </>
            )}
          </>
        )}
        {kind === "treatment" && (
          <>
            <Text style={styles.small}>{t("medicineHelp")}</Text>
            <Text style={styles.label}>{t("unit")}</Text>
            {choices(
              "unit",
              ["kg", "g", "l", "ml", "pieces"].map((v) => ({
                value: v,
                label: t(v as Key),
              })),
            )}
          </>
        )}
        {(["harvest", "growth"].includes(kind) ||
          (kind === "observation" && !!draft.mortalityCount?.trim())) && (
          <>
            <Text style={styles.label}>{t("species")}</Text>
            {choices(
              "species",
              Array.from(
                new Set(
                  state.stocking
                    .filter((x) => x.cycleId === cycle?.id)
                    .map((x) => x.species),
                ),
              ).map((v) => ({ value: v, label: v })),
            )}
            {!state.stocking.some((x) => x.cycleId === cycle?.id) && (
              <Text style={styles.notice}>{t("noSpecies")}</Text>
            )}
          </>
        )}
        {admin &&
          ["feed", "treatment", "expense", "harvest"].includes(kind) &&
          field("cost", "cost", true, kind !== "expense", "costHelp")}
        {admin && kind === "harvest" && field("revenue", "revenue", true, true)}
        {kind === "water" && (
          <>
            <Text style={styles.small}>{t("readingHelp")}</Text>
            {parameters.map((p) => (
              <Field
                key={p}
                label={`${t(p)} (${units[p]})`}
                numeric
                value={readings[p] || ""}
                onChange={(v) => setReadings((r) => ({ ...r, [p]: v }))}
              />
            ))}
            <View style={styles.between}>
              <Text style={[styles.label, { flex: 1 }]}>{t("isReport")}</Text>
              <Switch
                accessibilityLabel={t("isReport")}
                value={report}
                onValueChange={setReport}
                trackColor={{ true: "#205e45" }}
              />
            </View>
            <Text style={styles.small}>{t("reportHelp")}</Text>
          </>
        )}
        {kind === "observation" && (
          <Text style={styles.small}>{t("observationHelp")}</Text>
        )}
        <Field
          label={
            t("notes") + (kind === "observation" ? "" : " · " + t("optional"))
          }
          multiline
          value={draft.notes || ""}
          onChange={(v) => change("notes", v)}
        />
        {["water", "treatment", "observation"].includes(kind) && (
          <>
            <Text style={styles.section}>{t("attachments")}</Text>
            {kind === "treatment" && (
              <Text style={styles.small}>{t("photoHint")}</Text>
            )}
            <View style={styles.wrap}>
              <Button
                label={t("camera")}
                icon="camera-outline"
                disabled={busy}
                onPress={() => attach("camera")}
              />
              <Button
                label={t("gallery")}
                icon="images-outline"
                disabled={busy}
                onPress={() => attach("gallery")}
              />
              <Button
                label={t("document")}
                icon="document-outline"
                disabled={busy}
                onPress={() => attach("document")}
              />
            </View>
            {fileList(attachments, true)}
          </>
        )}
        <Button label={t("review")} primary disabled={busy} onPress={review} />
      </>
    );
  else if (screen === "review" && pending)
    body = (
      <>
        {heading(t("reviewTitle"))}
        {summary(pending)}
        {allocationView(pending)}
        {fileList(pending.attachments)}
        <Text style={styles.small}>
          {cloud ? cw.connected : t("localOnly")}
        </Text>
        <Button
          label={busy ? t("saving") : t("save")}
          primary
          disabled={busy}
          onPress={() =>
            commit({ ...state, entries: [...state.entries, pending] }, () => {
              setPending(null);
              go("pond");
            })
          }
        />
        <Button label={t("edit")} disabled={busy} onPress={() => go("entry")} />
      </>
    );
  else if (screen === "entryDetail" && detail)
    body = (
      <>
        {heading(t(detail.kind))}
        {summary(detail)}
        {allocationView(detail)}
        {admin &&
          cloud &&
          (confirmTrash === detail.id ? (
            <View style={styles.card}>
              <Text>{trashWords(state.language).question}</Text>
              <Button
                label={trashWords(state.language).confirm}
                disabled={busy}
                onPress={() => void changeTrash(detail.id, true)}
              />
              <Button
                label={trashWords(state.language).cancel}
                disabled={busy}
                onPress={() => setConfirmTrash(null)}
              />
            </View>
          ) : (
            <Button
              label={trashWords(state.language).remove}
              disabled={busy}
              icon="trash-outline"
              onPress={() => setConfirmTrash(detail.id)}
            />
          ))}
        {fileList(detail.attachments)}
        {detail.kind === "water" && (
          <Text style={styles.notice}>{t("aiLater")}</Text>
        )}
      </>
    );
  else if (screen === "expenseForm")
    body = (
      <>
        {heading(t("addExpense"))}
        <Text style={styles.small}>{t("expenseHelp")}</Text>
        <Text style={styles.label}>{t("appliesTo")}</Text>
        {choices("expensePond", [
          { value: "", label: t("wholeFarm") },
          ...state.ponds.map((p) => ({ value: p.id, label: p.name })),
        ])}
        <Text style={styles.label}>{t("expenseCategory")}</Text>
        {choices(
          "category",
          [
            "feed",
            "labour",
            "electricity",
            "lease",
            "transport",
            "repairs",
            "other",
          ].map((k) => ({ value: k, label: t(k as Key) })),
        )}
        {field("amount", "expenseAmount", true)}
        {field("date", "date")}
        <Field
          label={t("notes") + " · " + t("optional")}
          value={draft.notes || ""}
          onChange={(v) => change("notes", v)}
          multiline
        />
        <Text style={styles.section}>{t("expenseReceipt")}</Text>
        <View style={styles.wrap}>
          <Button
            label={t("camera")}
            disabled={busy}
            onPress={() => attach("camera")}
          />
          <Button
            label={t("gallery")}
            disabled={busy}
            onPress={() => attach("gallery")}
          />
          <Button
            label={t("document")}
            disabled={busy}
            onPress={() => attach("document")}
          />
        </View>
        {fileList(attachments, true)}
        <Button
          label={t("review")}
          primary
          disabled={busy}
          onPress={reviewExpense}
        />
      </>
    );
  else if (screen === "expenseReview" && pendingExpense)
    body = (
      <>
        {heading(t("expenseReview"))}
        {expenseSummary(pendingExpense)}
        {fileList(pendingExpense.attachments)}
        <Button
          label={t("save")}
          primary
          disabled={busy}
          onPress={() =>
            commit(
              {
                ...state,
                expenses: [...(state.expenses || []), pendingExpense],
              },
              () => {
                setPendingExpense(null);
                go("expenses");
              },
            )
          }
        />
        <Button label={t("edit")} onPress={() => go("expenseForm")} />
      </>
    );
  else if (screen === "expenses") {
    const ledger = expenseLedger(state);
    const displayed = ledger.filter((r) =>
      filter === "shared" ? r.pondId === null : !filter || r.pondId === filter,
    );
    body = (
      <>
        {heading(t("expenses"))}
        <Button
          label={t("addExpense")}
          primary
          icon="add"
          onPress={beginExpense}
        />
        <View style={styles.card}>
          <Text style={styles.body}>
            {t("farmTotal")}: {money(ledger.reduce((a, r) => a + r.amount, 0))}
          </Text>
          <Text style={styles.small}>
            {t("sharedTotal")}:{" "}
            {money(
              ledger
                .filter((r) => r.pondId === null)
                .reduce((a, r) => a + r.amount, 0),
            )}
          </Text>
          <Text style={styles.small}>{t("unallocated")}</Text>
        </View>
        <View style={styles.wrap}>
          <Button label={t("all")} onPress={() => setFilter("")} />
          <Button label={t("wholeFarm")} onPress={() => setFilter("shared")} />
          {state.ponds.map((p) => (
            <Button key={p.id} label={p.name} onPress={() => setFilter(p.id)} />
          ))}
        </View>
        {!!filter && filter !== "shared" && (
          <Text style={styles.section}>
            {t("pondTotal")}:{" "}
            {money(displayed.reduce((a, r) => a + r.amount, 0))}
          </Text>
        )}
        <Text style={styles.small}>{t("expenseHelp")}</Text>
        {displayed.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {money(r.amount)} · {t(r.category as Key)}
            </Text>
            <Text style={styles.small}>
              {r.pondId
                ? state.ponds.find((p) => p.id === r.pondId)?.name
                : t("wholeFarm")}{" "}
              · {r.date}
            </Text>
            {!!r.notes && <Text style={styles.body}>{r.notes}</Text>}
            {r.source === "entry" ? (
              <Button
                label={t("view")}
                onPress={() => {
                  setDetail(state.entries.find((e) => e.id === r.sourceId)!);
                  go("entryDetail");
                }}
              />
            ) : r.source === "expense" ? (
              fileList(
                state.expenses?.find((e) => e.id === r.sourceId)?.attachments ||
                  [],
              )
            ) : (
              <Text style={styles.small}>{t("fromRecord")}</Text>
            )}
          </View>
        ))}
        {!displayed.length && (
          <Text style={styles.subtitle}>{t("emptyRecords")}</Text>
        )}
      </>
    );
  } else if (screen === "settings" && trashOpen && admin && cloud)
    body = (
      <>
        {heading(trashWords(state.language).trash, state.farmName)}
        <Trash
          org={cloud.org}
          language={state.language}
          restore={(id) => changeTrash(id, false)}
        />
        <Button
          label={trashWords(state.language).refresh}
          disabled={busy}
          onPress={async () => {
            try {
              setState(await load());
              setError("");
            } catch {
              setError(trashWords(state.language).error);
            }
          }}
        />
      </>
    );
  else if (screen === "settings" && teamOpen && admin && cloud)
    body = (
      <>
        {heading(teamWords(state.language).team, state.farmName)}
        <Team
          org={cloud.org}
          ponds={state.ponds}
          language={state.language}
          onChanged={async () => setState(await load())}
        />
      </>
    );
  else if (screen === "settings")
    body = (
      <>
        {heading(t("settings"))}
        {cloud && (
          <>
            <Text style={styles.badge}>
              {admin ? cw.admin : cw.permissions}
            </Text>

            <Button
              label={cw.refresh}
              disabled={busy}
              onPress={() => {
                setLoaded(false);
                read();
              }}
            />
            <Button label={cw.choose} onPress={chooseFarm} />
            <Button
              label={cw.signOut}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                const { error } = await supabase!.auth.signOut({
                  scope: "local",
                });
                if (error) {
                  setError(cw.error);
                  setBusy(false);
                }
              }}
            />
            {admin && (
              <>
                <Button
                  label={teamWords(state.language).team}
                  onPress={() => setTeamOpen(!teamOpen)}
                />
                <Button
                  label={trashWords(state.language).trash}
                  onPress={() => {
                    setTrashOpen(true);
                    setTeamOpen(false);
                  }}
                />
                <Button
                  label={cw.backup}
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await exportBackup(await loadLocal());
                    } catch {
                      setError(cw.error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                {!state.ponds.length && (
                  <>
                    <Text style={styles.small}>{cw.importHelp}</Text>
                    <Button
                      label={cw.import}
                      disabled={busy}
                      onPress={async () => {
                        try {
                          const local = await loadLocal();
                          if (!local.ponds.length) {
                            setError(cw.empty);
                            return;
                          }
                          await commit({
                            ...local,
                            farmName: state.farmName,
                            language: state.language,
                            revision: state.revision,
                          });
                        } catch {
                          setError(cw.error);
                        }
                      }}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}

        <Text style={styles.section}>{t("language")}</Text>
        {languages.map((l) => (
          <Button
            key={l.id}
            label={(state.language === l.id ? "✓ " : "") + l.name}
            disabled={busy}
            onPress={() => commit({ ...state, language: l.id })}
          />
        ))}
        {admin && (
          <>
            <Field
              label={t("farmName")}
              value={draft.farmName ?? state.farmName}
              onChange={(v) => change("farmName", v)}
            />
            <Button
              label={t("save")}
              disabled={busy}
              onPress={() =>
                commit({
                  ...state,
                  farmName: (draft.farmName ?? state.farmName).trim(),
                })
              }
            />
          </>
        )}
        <Text style={styles.section}>{t("notifications")}</Text>
        <Text style={styles.small}>{t("reminderHelp")}</Text>
        <Button
          label={t("enableReminders")}
          icon="notifications-outline"
          onPress={() =>
            refreshReminders(state, true)
              .then(() => setToast(t("notificationReady")))
              .catch((e) =>
                fail(
                  ["webNotice", "notificationDenied"].includes(e.message)
                    ? (e.message as Key)
                    : "error",
                ),
              )
          }
        />
        {admin && (
          <>
            <Text style={styles.section}>{t("export")}</Text>
            <Text style={styles.small}>{t("exportHelp")}</Text>
            <Button
              label={t("export")}
              disabled={busy}
              icon="download-outline"
              onPress={async () => {
                setBusy(true);
                try {
                  await exportBackup(state);
                  setToast(t("exportDone"));
                } catch {
                  fail("error");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Text style={styles.notice}>
              {cloud ? cw.connected : t("localExplanation")}
            </Text>
          </>
        )}
        <Text style={styles.small}>{t("privacy")}</Text>
        {Platform.OS === "web" && (
          <Text style={styles.small}>{t("webNotice")}</Text>
        )}
      </>
    );
  else
    body = (
      <>
        {heading(t("records"))}
        {admin && (
          <Button
            label={t("expenses")}
            icon="wallet-outline"
            onPress={() => {
              setFilter("");
              go("expenses");
            }}
          />
        )}
        <View style={styles.wrap}>
          <Button label={t("all")} onPress={() => setFilter("")} />
          {state.ponds.map((p) => (
            <Button
              key={p.id}
              label={(filter === p.id ? "✓ " : "") + p.name}
              onPress={() => setFilter(p.id)}
            />
          ))}
        </View>
        {entryList(state.entries.filter((e) => !filter || e.pondId === filter))}
      </>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons
            accessible={false}
            aria-hidden={true}
            name="water"
            size={24}
            color="#205e45"
          />
          <Text style={styles.brand}>{t("app")}</Text>
        </View>
        {state.language && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings")}
            style={styles.gear}
            onPress={() => {
              if (
                [
                  "entry",
                  "review",
                  "pondForm",
                  "stockForm",
                  "cropForm",
                  "expenseForm",
                  "expenseReview",
                ].includes(screen)
              ) {
                return;
              }
              setDraft({});
              go("settings");
            }}
          >
            <Ionicons
              accessible={false}
              aria-hidden={true}
              name="settings-outline"
              size={25}
              color="#205e45"
            />
          </Pressable>
        )}
      </View>
      {state.language && (
        <View style={styles.local}>
          <Ionicons
            accessible={false}
            aria-hidden={true}
            name="phone-portrait-outline"
            size={15}
            color="#52665b"
          />
          <Text style={styles.small}>
            {cloud ? cw.connected : t("localOnly")}
          </Text>
        </View>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {state.language &&
            !["today", "ponds", "records"].includes(screen) && (
              <Button
                label={t("back")}
                icon="arrow-back"
                onPress={back}
                disabled={busy}
              />
            )}
          {!!toast && (
            <Text accessibilityLiveRegion="polite" style={styles.success}>
              {toast}
            </Text>
          )}
          {body}
          {!!error && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={styles.error}
            >
              {error}
            </Text>
          )}
          {!!error && cloud && (
            <Button
              label={cw.refresh}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  setState(await load());
                  setError("");
                } catch {
                  setError(cw.error);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          {busy && <ActivityIndicator style={{ margin: 12 }} color="#205e45" />}
        </ScrollView>
      </KeyboardAvoidingView>
      {state.language &&
        ["today", "ponds", "records", "pond", "entryDetail"].includes(
          screen,
        ) && (
          <View style={styles.nav}>
            {(
              [
                { key: "today", icon: "sunny-outline" },
                { key: "ponds", icon: "water-outline" },
                { key: "records", icon: "journal-outline" },
              ] as const
            ).map((n) => (
              <Pressable
                key={n.key}
                accessibilityRole="tab"
                accessibilityLabel={t(n.key)}
                accessibilityState={{ selected: screen === n.key }}
                onPress={() => go(n.key)}
                style={[styles.tab, screen === n.key && styles.selected]}
              >
                <Ionicons
                  accessible={false}
                  aria-hidden={true}
                  name={n.icon}
                  size={24}
                  color="#205e45"
                />
                <Text style={styles.navText}>{t(n.key)}</Text>
              </Pressable>
            ))}
          </View>
        )}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <CloudGate>
        <AppContent />
      </CloudGate>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f6f2" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#e1e7df",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  brand: { fontSize: 20, fontWeight: "700", color: "#18372c", flexShrink: 1 },
  gear: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  local: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e7efe5",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 10,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  title: { fontSize: 29, fontWeight: "700", color: "#18372c", lineHeight: 42 },
  subtitle: { fontSize: 17, lineHeight: 28, color: "#52665b", marginTop: 6 },
  section: {
    fontSize: 21,
    fontWeight: "600",
    lineHeight: 32,
    color: "#18372c",
    marginTop: 18,
    marginBottom: 8,
  },
  body: { fontSize: 18, lineHeight: 29, color: "#18372c" },
  small: { fontSize: 14, lineHeight: 23, color: "#52665b", flexShrink: 1 },
  cardTitle: {
    fontSize: 20,
    lineHeight: 31,
    fontWeight: "600",
    color: "#18372c",
    flexShrink: 1,
  },
  button: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#d5dfd4",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginVertical: 4,
  },
  buttonText: {
    fontSize: 17,
    lineHeight: 26,
    color: "#205e45",
    fontWeight: "600",
    flexShrink: 1,
  },
  primary: { backgroundColor: "#205e45", borderColor: "#205e45" },
  pondCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dce4d9",
    backgroundColor: "#fff",
    gap: 6,
    marginBottom: 3,
  },
  card: {
    padding: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce4d9",
    backgroundColor: "#fff",
    gap: 7,
    marginVertical: 5,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#edf2e9",
    color: "#37503e",
    padding: 9,
    borderRadius: 9,
    fontSize: 14,
    lineHeight: 23,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  context: {
    backgroundColor: "#e5eee2",
    padding: 17,
    borderRadius: 16,
    gap: 4,
    marginBottom: 10,
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: {
    width: "47%",
    flexGrow: 1,
    minHeight: 118,
    borderRadius: 18,
    padding: 17,
    gap: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4d9",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 17,
    lineHeight: 27,
    color: "#18372c",
    fontWeight: "600",
  },
  field: { marginVertical: 6, gap: 8 },
  label: { fontSize: 17, lineHeight: 28, fontWeight: "600", color: "#18372c" },
  input: {
    borderWidth: 1,
    borderColor: "#becfbd",
    borderRadius: 13,
    minHeight: 58,
    padding: 14,
    fontSize: 19,
    lineHeight: 29,
    backgroundColor: "#fff",
    color: "#18372c",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 13,
    paddingHorizontal: 17,
    borderRadius: 13,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#cdd9ca",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  chipText: { fontSize: 17, lineHeight: 26, color: "#205e45" },
  selected: { backgroundColor: "#dfead8" },
  notice: {
    backgroundColor: "#fff0d2",
    color: "#664b16",
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 26,
    marginVertical: 10,
  },
  error: {
    backgroundColor: "#ffebe8",
    color: "#922e24",
    padding: 15,
    borderRadius: 12,
    fontSize: 17,
    lineHeight: 27,
  },
  success: {
    backgroundColor: "#deeedc",
    color: "#205e45",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 27,
  },
  nav: {
    backgroundColor: "#fff",
    padding: 8,
    borderTopWidth: 1,
    borderColor: "#dce4d9",
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 67,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    padding: 8,
    gap: 5,
  },
  navText: {
    fontSize: 13,
    lineHeight: 22,
    color: "#205e45",
    fontWeight: "600",
    textAlign: "center",
  },
  empty: {
    padding: 24,
    alignItems: "flex-start",
    backgroundColor: "#e7efe3",
    borderRadius: 22,
    marginVertical: 10,
  },
  heroIcon: {
    backgroundColor: "#e2eddb",
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  photo: {
    width: "100%",
    height: 190,
    borderRadius: 12,
    resizeMode: "contain",
    backgroundColor: "#edf2e9",
  },
  amount: { fontSize: 28, lineHeight: 40, fontWeight: "700", color: "#205e45" },
});
