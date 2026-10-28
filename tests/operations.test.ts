import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, State, Entry, cropTotals } from "../src/domain";
import {
  batchLedger,
  expenseLedger,
  validateExpense,
  validateRemoval,
} from "../src/operations";
const setup = (): State => ({
  ...structuredClone(emptyState),
  ponds: [
    {
      id: "p",
      name: "Pond",
      location: "Canal",
      area: 3,
      waterType: "fresh",
      reportInterval: null,
      createdAt: "",
    },
  ],
  cycles: [{ id: "c", pondId: "p", name: "Period", startDate: "2026-01-01" }],
  stocking: [
    {
      id: "old",
      cycleId: "c",
      species: "Rohu",
      category: "fish",
      date: "2026-01-01",
      count: 3000,
      averageGrams: 20,
      seedCost: 1000,
      supplier: "",
    },
    {
      id: "new",
      cycleId: "c",
      species: "Rohu",
      category: "fish",
      date: "2026-03-01",
      count: 5000,
      averageGrams: 10,
      seedCost: 2000,
      supplier: "",
    },
  ],
});
const harvest = (patch: Partial<Entry> = {}): Entry => ({
  id: "h",
  pondId: "p",
  cycleId: "c",
  kind: "harvest",
  date: "2026-04-01",
  createdAt: "2026-04-01T12:00:00Z",
  product: "",
  quantity: 4,
  unit: "tonnes",
  cost: 0,
  revenue: 0,
  species: "Rohu",
  notes: "",
  readings: [],
  attachments: [],
  report: false,
  harvestedCount: 4000,
  ...patch,
});
test("partial harvest uses oldest eligible batches and preserves originals", () => {
  const s = setup();
  s.entries = [harvest({ countApproximate: true })];
  const original = JSON.stringify(s.stocking);
  const r = batchLedger(s, "c");
  assert.deepEqual(
    r.batches.map((b) => [b.stock.id, b.remaining, b.removed]),
    [
      ["old", 0, 3000],
      ["new", 4000, 1000],
    ],
  );
  assert.equal(r.allocations.length, 2);
  assert.equal(JSON.stringify(s.stocking), original);
  s.stocking.push({
    ...s.stocking[0],
    id: "later",
    date: "2026-05-01",
    count: 2000,
  });
  assert.equal(batchLedger(s, "c").batches[2].remaining, 2000);
});
test("future stocking cannot fund past harvest; backdated deductions cannot invalidate later ones", () => {
  const s = setup();
  assert.throws(
    () => validateRemoval(s, harvest({ date: "2026-02-01" })),
    /removalExceeds/,
  );
  s.entries = [harvest({ harvestedCount: 7000 })];
  assert.throws(
    () =>
      validateRemoval(
        s,
        harvest({ id: "backdated", date: "2026-03-20", harvestedCount: 2000 }),
      ),
    /removalExceeds/,
  );
});
test("missing harvest counts remain incomplete and species are isolated", () => {
  const s = setup();
  s.stocking.push({ ...s.stocking[0], id: "catla", species: "Catla" });
  s.entries = [
    harvest({ harvestedCount: null }),
    harvest({
      id: "d",
      kind: "observation",
      harvestedCount: undefined,
      mortalityCount: 20,
    }),
  ];
  const r = batchLedger(s, "c");
  assert.equal(r.unknown.has("Rohu"), true);
  assert.equal(r.batches.find((b) => b.stock.id === "catla")?.remaining, 3000);
  assert.equal(r.batches.find((b) => b.stock.id === "old")?.removed, 20);
});
test("farm expense ledger includes originals once and leaves shared costs unallocated", () => {
  const s = setup();
  s.entries = [
    harvest({ kind: "feed", cost: 500 }),
    harvest({ id: "legacy", kind: "expense", cost: 100 }),
  ];
  s.expenses = [
    {
      id: "shared",
      pondId: null,
      category: "electricity",
      amount: 1000,
      date: "2026-04-01",
      notes: "",
      attachments: [],
      createdAt: "",
    },
    {
      id: "direct",
      pondId: "p",
      cycleId: "c",
      category: "labour",
      amount: 250,
      date: "2026-04-01",
      notes: "",
      attachments: [],
      createdAt: "",
    },
  ];
  const ledger = expenseLedger(s);
  assert.equal(
    ledger.reduce((a, r) => a + r.amount, 0),
    4850,
  );
  assert.equal(
    ledger.filter((r) => r.pondId === "p").reduce((a, r) => a + r.amount, 0),
    3850,
  );
  assert.equal(cropTotals(s, "c").costs, 3850);
  assert.equal(new Set(ledger.map((r) => r.id)).size, ledger.length);
  validateExpense(s, s.expenses![0]);
  assert.throws(
    () => validateExpense(s, { ...s.expenses![0], pondId: "missing" }),
    /required/,
  );
  assert.throws(
    () => validateExpense(s, { ...s.expenses![0], amount: 0 }),
    /invalidNumber/,
  );
});
