export type Language = "en" | "te" | "hi";
export type Kind =
  | "feed"
  | "treatment"
  | "water"
  | "observation"
  | "expense"
  | "harvest"
  | "growth";
export type Attachment = {
  id: string;
  uri: string;
  name: string;
  mime: string;
};
export type Pond = {
  id: string;
  name: string;
  location: string;
  area: number;
  waterType: "fresh" | "brackish";
  reportInterval: number | null;
  createdAt: string;
};
export type Cycle = {
  id: string;
  pondId: string;
  name: string;
  startDate: string;
  closedAt?: string;
};
export type Stocking = {
  id: string;
  cycleId: string;
  species: string;
  category: "fish" | "prawn";
  date: string;
  count: number;
  averageGrams: number;
  seedCost: number;
  supplier: string;
};
export type Reading = {
  parameter:
    | "ph"
    | "oxygen"
    | "temperature"
    | "ammonia"
    | "nitrite"
    | "alkalinity"
    | "salinity";
  value: number;
  unit: string;
};
export type Entry = {
  id: string;
  pondId: string;
  cycleId: string;
  kind: Kind;
  date: string;
  createdAt: string;
  product: string;
  quantity: number | null;
  bagWeightKg?: number;
  harvestedCount?: number | null;
  countApproximate?: boolean;
  mortalityCount?: number | null;
  unit: string;
  cost: number;
  revenue: number;
  species: string;
  notes: string;
  readings: Reading[];
  attachments: Attachment[];
  report: boolean;
};
export type FarmExpense = {
  id: string;
  pondId: string | null;
  cycleId?: string;
  category: string;
  date: string;
  amount: number;
  notes: string;
  attachments: Attachment[];
  createdAt: string;
};
export type State = {
  version: 1;
  language: Language | null;
  farmName: string;
  ponds: Pond[];
  cycles: Cycle[];
  stocking: Stocking[];
  entries: Entry[];
  revision: number;
  expenses?: FarmExpense[];
  feedProducts?: string[];
  speciesCatalog?: { name: string; category: "fish" | "prawn" }[];
};
export const emptyState: State = {
  version: 1,
  language: null,
  farmName: "",
  ponds: [],
  cycles: [],
  stocking: [],
  entries: [],
  revision: 0,
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function numberValue(value: string, allowZero = false): number | null {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) ? n : null;
}
export const activeCycle = (s: State, pondId: string) =>
  s.cycles.find((c) => c.pondId === pondId && !c.closedAt);
export function cropTotals(s: State, cycleId: string) {
  const e = s.entries.filter((x) => x.cycleId === cycleId);
  const seed = s.stocking
    .filter((x) => x.cycleId === cycleId)
    .reduce((a, x) => a + x.seedCost, 0);
  const costs =
    seed +
    e.reduce((a, x) => a + x.cost, 0) +
    (s.expenses || [])
      .filter((x) => x.cycleId === cycleId)
      .reduce((a, x) => a + x.amount, 0);
  const revenue = e.reduce((a, x) => a + x.revenue, 0);
  return {
    costs,
    revenue,
    balance: revenue - costs,
    feedKg: e
      .filter((x) => x.kind === "feed")
      .reduce((a, x) => a + feedWeightKg(x), 0),
    harvestKg: e
      .filter((x) => x.kind === "harvest")
      .reduce((a, x) => a + harvestWeightKg(x), 0),
  };
}
export function reportDue(s: State, pond: Pond, on = today()) {
  const cycle = activeCycle(s, pond.id);
  if (!cycle || !pond.reportInterval) return null;
  const latest = s.entries
    .filter((e) => e.cycleId === cycle.id && e.kind === "water" && e.report)
    .map((e) => e.date)
    .sort()
    .at(-1);
  if (!latest) return {last: null, due: null, overdueDays: null};
  const anchor = latest;
  const next = new Date(anchor + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + pond.reportInterval);
  const due = next.toISOString().slice(0, 10);
  return {
    last: latest || null,
    due,
    overdueDays: Math.floor(
      (Date.parse(on + "T12:00:00Z") - Date.parse(due + "T12:00:00Z")) /
        86400000,
    ),
  };
}
export function validateState(s: State) {
  if (
    s.version !== 1 ||
    !Array.isArray(s.ponds) ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.cycles) ||
    !Array.isArray(s.stocking)
  )
    throw Error("Invalid data");
  return s;
}
export function assertEntry(s: State, e: Entry) {
  const c = s.cycles.find(
    (c) => c.id === e.cycleId && c.pondId === e.pondId && !c.closedAt,
  );
  if (!c) throw Error("invalidCycle");
  if (!isDate(e.date) || e.date < c.startDate || e.date > today())
    throw Error("invalidDate");
  if (
    ["feed", "treatment", "harvest", "growth"].includes(e.kind) &&
    (!(e.quantity! > 0) || !Number.isFinite(e.quantity))
  )
    throw Error("invalidNumber");
  if (
    e.cost < 0 ||
    e.revenue < 0 ||
    !Number.isFinite(e.cost) ||
    !Number.isFinite(e.revenue)
  )
    throw Error("invalidNumber");
  if (e.kind === "feed" && !["kg", "bag"].includes(e.unit))
    throw Error("unitRequired");
  if (
    e.kind === "feed" &&
    e.unit === "bag" &&
    (!e.bagWeightKg ||
      !Number.isFinite(e.bagWeightKg) ||
      e.bagWeightKg <= 0 ||
      !Number.isFinite((e.quantity || 0) * e.bagWeightKg))
  )
    throw Error("invalidBagWeight");
  if (e.kind === "harvest" && !["kg", "tonnes"].includes(e.unit))
    throw Error("unitRequired");
  if (
    e.harvestedCount != null &&
    (e.kind !== "harvest" ||
      !Number.isSafeInteger(e.harvestedCount) ||
      e.harvestedCount <= 0)
  )
    throw Error("invalidCount");
  if (
    e.mortalityCount != null &&
    (e.kind !== "observation" ||
      !Number.isSafeInteger(e.mortalityCount) ||
      e.mortalityCount <= 0)
  )
    throw Error("invalidCount");
  if (
    e.mortalityCount != null &&
    !s.stocking.some((x) => x.cycleId === c.id && x.species === e.species)
  )
    throw Error("chooseSpecies");
  if (e.kind === "treatment" && !e.product.trim()) throw Error("required");
  if (
    ["growth", "harvest"].includes(e.kind) &&
    !s.stocking.some((x) => x.cycleId === c.id && x.species === e.species)
  )
    throw Error("chooseSpecies");
  if (e.kind === "water" && !e.readings.length && !e.attachments.length)
    throw Error("addReading");
  if (e.report && !e.attachments.length) throw Error("attachReport");
  if (e.kind === "observation" && !e.notes.trim()) throw Error("required");
}
export const parameters: Reading["parameter"][] = [
  "ph",
  "oxygen",
  "temperature",
  "ammonia",
  "nitrite",
  "alkalinity",
  "salinity",
];
export const units: Record<Reading["parameter"], string> = {
  ph: "pH",
  oxygen: "mg/L",
  temperature: "°C",
  ammonia: "mg/L TAN",
  nitrite: "mg/L NO₂-N",
  alkalinity: "mg/L CaCO₃",
  salinity: "ppt",
};

export function harvestWeightKg(e: Entry): number {
  return (e.quantity || 0) * (e.unit === "tonnes" ? 1000 : 1);
}
export function speciesBalances(s: State, cycleId: string) {
  const stock = s.stocking.filter((x) => x.cycleId === cycleId);
  return Array.from(new Set(stock.map((x) => x.species))).map((species) => {
    const stocked = stock
      .filter((x) => x.species === species)
      .reduce((a, x) => a + x.count, 0);
    const entries = s.entries.filter(
      (x) => x.cycleId === cycleId && x.species === species,
    );
    const harvests = entries.filter((x) => x.kind === "harvest");
    const harvested = harvests.reduce((a, x) => a + (x.harvestedCount ?? 0), 0);
    const deaths = entries
      .filter((x) => x.kind === "observation")
      .reduce((a, x) => a + (x.mortalityCount ?? 0), 0);
    const incomplete = harvests.some((x) => x.harvestedCount == null);
    return {
      species,
      stocked,
      harvested,
      deaths,
      incomplete,
      approximate: harvests.some((x) => x.countApproximate),
      remaining: incomplete ? null : stocked - harvested - deaths,
    };
  });
}

export const speciesKey = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function speciesOptions(s: State, category: "fish" | "prawn") {
  const defaults =
    category === "fish"
      ? ["Rohu", "Catla", "Mrigal", "Tilapia", "Pangasius"]
      : ["Scampi", "Vannamei"];
  const names = [
    ...s.stocking.filter((x) => x.category === category).map((x) => x.species),
    ...(s.speciesCatalog || [])
      .filter((x) => x.category === category)
      .map((x) => x.name),
    ...defaults,
  ];
  const unique = new Map<string, string>();
  for (const name of names)
    if (!unique.has(speciesKey(name))) unique.set(speciesKey(name), name);
  return [...unique.values()];
}

export function feedWeightKg(e: Entry) {
  return (e.quantity || 0) * (e.unit === "bag" ? e.bagWeightKg || 0 : 1);
}
export function feedProductOptions(s: State) {
  const names = [
    ...(s.feedProducts || []),
    ...s.entries
      .filter((e) => e.kind === "feed" && e.product)
      .map((e) => e.product),
  ];
  const unique = new Map<string, string>();
  for (const name of names)
    if (!unique.has(speciesKey(name))) unique.set(speciesKey(name), name);
  return [...unique.values()];
}
export function lastFeedDefaults(s: State) {
  const e = s.entries.filter((e) => e.kind === "feed").at(-1);
  return {
    unit: e?.unit === "bag" ? "bag" : "kg",
    product: e?.product || "",
    bagWeight: e?.bagWeightKg ? String(e.bagWeightKg) : "",
  };
}
