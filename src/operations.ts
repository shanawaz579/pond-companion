import { State, Stocking, Entry, isDate, today } from "./domain";
export type BatchBalance = {
  stock: Stocking;
  remaining: number;
  removed: number;
  uncertain: boolean;
};
export function batchLedger(s: State, cycleId: string) {
  const batches: BatchBalance[] = s.stocking
    .filter((x) => x.cycleId === cycleId)
    .map((stock) => ({
      stock,
      remaining: stock.count,
      removed: 0,
      uncertain: false,
    }))
    .sort(
      (a, b) =>
        a.stock.date.localeCompare(b.stock.date) ||
        a.stock.id.localeCompare(b.stock.id),
    );
  const allocations: {
    entryId: string;
    batchId: string;
    count: number;
    approximate: boolean;
  }[] = [];
  const discrepancies: { entryId: string; count: number }[] = [];
  const unknown = new Set<string>();
  const events = s.entries
    .filter(
      (e) =>
        e.cycleId === cycleId &&
        (e.kind === "harvest" ||
          (e.kind === "observation" && e.mortalityCount != null)),
    )
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  for (const e of events) {
    let count = e.kind === "harvest" ? e.harvestedCount : e.mortalityCount;
    if (count == null) {
      unknown.add(e.species);
      continue;
    }
    for (const b of batches) {
      if (b.stock.species !== e.species || b.stock.date > e.date || count <= 0)
        continue;
      const take = Math.min(count, b.remaining);
      if (take <= 0) continue;
      b.remaining -= take;
      b.removed += take;
      b.uncertain ||= !!e.countApproximate;
      count -= take;
      allocations.push({
        entryId: e.id,
        batchId: b.stock.id,
        count: take,
        approximate: !!e.countApproximate,
      });
    }
    if (count > 0) discrepancies.push({ entryId: e.id, count });
  }
  for (const b of batches) if (unknown.has(b.stock.species)) b.uncertain = true;
  return { batches, allocations, discrepancies, unknown };
}
export function expenseLedger(s: State) {
  const rows: {
    id: string;
    pondId: string | null;
    date: string;
    amount: number;
    category: string;
    source: "entry" | "stocking" | "expense";
    sourceId: string;
    notes: string;
  }[] = [];
  for (const e of s.entries)
    if (e.cost > 0)
      rows.push({
        id: "entry:" + e.id,
        pondId: e.pondId,
        date: e.date,
        amount: e.cost,
        category: e.kind,
        source: "entry",
        sourceId: e.id,
        notes: e.product || e.notes,
      });
  for (const x of s.stocking)
    if (x.seedCost > 0) {
      const c = s.cycles.find((c) => c.id === x.cycleId);
      if (c)
        rows.push({
          id: "stocking:" + x.id,
          pondId: c.pondId,
          date: x.date,
          amount: x.seedCost,
          category: "seedCost",
          source: "stocking",
          sourceId: x.id,
          notes: x.species,
        });
    }
  for (const x of s.expenses || [])
    rows.push({
      id: "expense:" + x.id,
      pondId: x.pondId,
      date: x.date,
      amount: x.amount,
      category: x.category,
      source: "expense",
      sourceId: x.id,
      notes: x.notes,
    });
  return rows.sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
}
export function validateExpense(
  s: State,
  e: NonNullable<State["expenses"]>[number],
) {
  if (e.pondId !== null && !s.ponds.some((p) => p.id === e.pondId))
    throw Error("required");
  if (!isDate(e.date) || e.date > today()) throw Error("expenseDateError");
  if (!Number.isFinite(e.amount) || e.amount <= 0) throw Error("invalidNumber");
  if (
    e.cycleId &&
    !s.cycles.some(
      (c) =>
        c.id === e.cycleId &&
        c.pondId === e.pondId &&
        c.startDate <= e.date &&
        (!c.closedAt || e.date <= c.closedAt.slice(0, 10)),
    )
  )
    throw Error("invalidCycle");
}
export function validateRemoval(s: State, e: Entry) {
  const before = new Map(
    batchLedger(s, e.cycleId).discrepancies.map((x) => [x.entryId, x.count]),
  );
  const after = batchLedger({ ...s, entries: [...s.entries, e] }, e.cycleId);
  if (after.discrepancies.some((x) => x.count > (before.get(x.entryId) || 0)))
    throw Error("removalExceeds");
}
