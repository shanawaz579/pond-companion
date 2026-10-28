import { State, Attachment, emptyState } from "./domain";
type Row = Record<string, any>;
export type FarmData = Record<string, Row[]> & {
  name: any;
  revision: any;
  role: any;
};
const files = (rows: Row[], field: string, id: string): Attachment[] =>
  rows
    .filter((a) => a[field] === id)
    .map((a) => ({
      id: a.id,
      uri: "cloud:" + a.object_path,
      name: a.filename,
      mime: a.mime_type,
    }));
export function decodeFarm(d: FarmData, language: State["language"]): State {
  return {
    ...emptyState,
    language,
    farmName: d.name,
    revision: Number(d.revision),
    ponds: d.ponds.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      area: Number(p.area_acres),
      waterType: p.water_type,
      reportInterval: p.report_interval_days,
      createdAt: p.created_at,
    })),
    cycles: d.cycles.map((c) => ({
      id: c.id,
      pondId: c.pond_id,
      name: c.name,
      startDate: c.start_date,
      ...(c.closed_at ? { closedAt: c.closed_at } : {}),
    })),
    stocking: d.stocking.map((s) => ({
      id: s.id,
      cycleId: s.cycle_id,
      species: s.species,
      category: s.category,
      date: s.stocked_on,
      count: Number(s.quantity),
      averageGrams: Number(s.average_grams),
      seedCost: Number(s.seed_cost || 0),
      supplier: s.supplier || "",
    })),
    entries: d.entries.map((e) => ({
      id: e.id,
      pondId: e.pond_id,
      cycleId: e.cycle_id,
      kind: e.kind,
      date: e.occurred_on,
      createdAt: e.created_at,
      product: e.product,
      quantity: e.quantity === null ? null : Number(e.quantity),
      bagWeightKg:
        e.bag_weight_kg === null ? undefined : Number(e.bag_weight_kg),
      harvestedCount: e.harvested_count,
      countApproximate: e.count_approximate,
      mortalityCount: e.mortality_count,
      unit: e.unit,
      cost: Number(e.cost || 0),
      revenue: Number(e.revenue || 0),
      species: e.species,
      notes: e.notes,
      report: e.is_lab_report,
      readings: d.water_readings
        .filter((w) => w.entry_id === e.id)
        .map((w) => ({
          parameter: w.parameter,
          value: Number(w.value),
          unit: w.unit,
        })),
      attachments: files(d.attachments, "entry_id", e.id),
    })),
    expenses: d.farm_expenses.map((e) => ({
      id: e.id,
      pondId: e.pond_id,
      cycleId: e.cycle_id || undefined,
      category: e.category,
      date: e.occurred_on,
      amount: Number(e.amount),
      notes: e.notes,
      createdAt: e.created_at,
      attachments: files(d.expense_attachments, "expense_id", e.id),
    })),
    speciesCatalog: d.species_catalog.map((s) => ({
      name: s.name,
      category: s.category,
    })),
    feedProducts: d.feed_products.map((f) => f.name),
  };
}
export function encodeChanges(
  before: State,
  next: State,
  uuid: () => string,
): Record<string, any> {
  const fresh = <T extends { id: string }>(prev: T[], items: T[]) =>
    items.filter((i) => !prev.some((p) => p.id === i.id));
  const changed = <T extends { id: string }>(prev: T[], items: T[]) =>
    items.filter(
      (i) =>
        JSON.stringify(prev.find((p) => p.id === i.id)) !== JSON.stringify(i),
    );
  const entries = fresh(before.entries, next.entries),
    expenses = fresh(before.expenses || [], next.expenses || []);
  const attach = (
    items: { id: string; attachments: Attachment[] }[],
    field: string,
  ) =>
    items.flatMap((e) =>
      e.attachments.map((a) => {
        if (!a.uri.startsWith("cloud:")) throw Error("File upload required");
        return {
          id: a.id,
          [field]: e.id,
          object_path: a.uri.slice(6),
          filename: a.name,
          mime_type: a.mime,
          created_at: new Date().toISOString(),
        };
      }),
    );
  return {
    ...(before.farmName !== next.farmName ? { name: next.farmName } : {}),
    ponds: changed(before.ponds, next.ponds).map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      area_acres: p.area,
      water_type: p.waterType,
      report_interval_days: p.reportInterval,
      created_at: p.createdAt,
    })),
    cycles: changed(before.cycles, next.cycles).map((c) => ({
      id: c.id,
      pond_id: c.pondId,
      name: c.name,
      start_date: c.startDate,
      closed_at: c.closedAt || null,
    })),
    stocking: fresh(before.stocking, next.stocking).map((s) => ({
      id: s.id,
      cycle_id: s.cycleId,
      species: s.species,
      category: s.category,
      stocked_on: s.date,
      quantity: s.count,
      average_grams: s.averageGrams,
      seed_cost: s.seedCost,
      supplier: s.supplier,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      pond_id: e.pondId,
      cycle_id: e.cycleId,
      kind: e.kind,
      occurred_on: e.date,
      created_at: e.createdAt,
      product: e.product,
      quantity: e.quantity,
      bag_weight_kg: e.bagWeightKg || null,
      harvested_count: e.harvestedCount || null,
      count_approximate: e.countApproximate || false,
      mortality_count: e.mortalityCount || null,
      unit: e.unit,
      cost: e.cost,
      revenue: e.revenue,
      species: e.species,
      notes: e.notes,
      is_lab_report: e.report,
    })),
    water_readings: entries.flatMap((e) =>
      e.readings.map((w) => ({
        id: uuid(),
        entry_id: e.id,
        parameter: w.parameter,
        value: w.value,
        unit: w.unit,
        source: e.report ? "lab" : "manual",
        measured_at: e.date + "T12:00:00Z",
      })),
    ),
    attachments: attach(entries, "entry_id"),
    farm_expenses: expenses.map((e) => ({
      id: e.id,
      pond_id: e.pondId,
      cycle_id: e.cycleId || null,
      category: e.category,
      occurred_on: e.date,
      created_at: e.createdAt,
      amount: e.amount,
      notes: e.notes,
    })),
    expense_attachments: attach(expenses, "expense_id"),
    species_catalog: (next.speciesCatalog || [])
      .filter(
        (s) =>
          !(before.speciesCatalog || []).some(
            (p) => p.name === s.name && p.category === s.category,
          ),
      )
      .map((s) => ({ id: uuid(), ...s, created_at: new Date().toISOString() })),
    feed_products: (next.feedProducts || [])
      .filter((n) => !before.feedProducts?.includes(n))
      .map((name) => ({
        id: uuid(),
        name,
        created_at: new Date().toISOString(),
      })),
  };
}
