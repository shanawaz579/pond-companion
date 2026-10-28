import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertEntry,
  cropTotals,
  emptyState,
  Entry,
  isDate,
  numberValue,
  reportDue,
  State,
  today,
} from "../src/domain";
import { en, te, hi } from "../src/i18n";
const fixture = (): State => ({
  ...structuredClone(emptyState),
  ponds: [
    {
      id: "p",
      name: "A",
      location: "Canal",
      area: 3,
      waterType: "fresh",
      reportInterval: 7,
      createdAt: "",
    },
  ],
  cycles: [{ id: "c", pondId: "p", name: "Crop", startDate: "2026-01-01" }],
});
const entry = (patch: Partial<Entry> = {}): Entry => ({
  id: "e",
  pondId: "p",
  cycleId: "c",
  kind: "water",
  date: "2026-01-02",
  createdAt: "2026-01-10",
  product: "",
  quantity: null,
  unit: "kg",
  cost: 0,
  revenue: 0,
  species: "",
  notes: "",
  readings: [],
  attachments: [
    { id: "a", uri: "local", mime: "application/pdf", name: "test.pdf" },
  ],
  report: true,
  ...patch,
});
test("reminders use sample date rather than upload date", () => {
  const s = fixture();
  s.entries = [entry()];
  assert.deepEqual(reportDue(s, s.ponds[0], "2026-01-11"), {
    last: "2026-01-02",
    due: "2026-01-09",
    overdueDays: 2,
  });
});
test("manual readings and older crop reports do not reset lab reminder", () => {
  const s = fixture();
  s.entries = [
    entry({ report: false, date: "2026-01-07" }),
    entry({ cycleId: "old", date: "2026-01-07" }),
  ];
  assert.deepEqual(reportDue(s, s.ponds[0], "2026-01-10"), {last:null,due:null,overdueDays:null});
});
test("disabled schedule and closed cycles have no reminder", () => {
  const s = fixture();
  s.ponds[0].reportInterval = null;
  assert.equal(reportDue(s, s.ponds[0]), null);
  s.ponds[0].reportInterval = 7;
  s.cycles[0].closedAt = today();
  assert.equal(reportDue(s, s.ponds[0]), null);
});
test("strict dates and numbers reject invalid or ambiguous data", () => {
  for (const d of ["2026-02-30", "2026-13-01", "01/02/2026", ""])
    assert.equal(isDate(d), false);
  assert.equal(isDate("2024-02-29"), true);
  for (const n of ["", "-2", "Infinity", "1e4", "1,000"])
    assert.equal(numberValue(n), null);
  assert.equal(numberValue("12.5"), 12.5);
  assert.equal(numberValue("0"), null);
  assert.equal(numberValue("0", true), 0);
});
test("cannot attach entries to wrong pond or closed crop", () => {
  const s = fixture();
  assert.throws(
    () => assertEntry(s, entry({ pondId: "other" })),
    /invalidCycle/,
  );
  s.cycles[0].closedAt = today();
  assert.throws(() => assertEntry(s, entry()), /invalidCycle/);
});
test("treatment amount and product are required; report needs original", () => {
  const s = fixture();
  assert.throws(
    () => assertEntry(s, entry({ kind: "treatment" })),
    /invalidNumber/,
  );
  assert.throws(
    () => assertEntry(s, entry({ kind: "treatment", quantity: 2 })),
    /required/,
  );
  assert.throws(
    () =>
      assertEntry(
        s,
        entry({
          attachments: [],
          readings: [{ parameter: "ph", value: 7, unit: "pH" }],
        }),
      ),
    /attachReport/,
  );
});
test("harvest requires a stocked species and sums actual revenue/costs", () => {
  const s = fixture();
  assert.throws(
    () =>
      assertEntry(
        s,
        entry({ kind: "harvest", quantity: 100, species: "Rohu" }),
      ),
    /chooseSpecies/,
  );
  s.stocking = [
    {
      id: "s",
      cycleId: "c",
      species: "Rohu",
      category: "fish",
      date: "2026-01-01",
      count: 1000,
      averageGrams: 10,
      seedCost: 3000,
      supplier: "",
    },
  ];
  s.entries = [
    entry({ kind: "feed", quantity: 25, cost: 1000, report: false }),
    entry({
      id: "h",
      kind: "harvest",
      quantity: 100,
      species: "Rohu",
      revenue: 15000,
      cost: 500,
      report: false,
    }),
  ];
  assertEntry(s, s.entries[1]);
  assert.deepEqual(cropTotals(s, "c"), {
    costs: 4500,
    revenue: 15000,
    balance: 10500,
    feedKg: 25,
    harvestKg: 100,
  });
});
test("English Telugu Hindi have complete translation parity", () => {
  for (const dict of [te, hi]) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort());
    for (const value of Object.values(dict)) assert.ok(value.trim());
  }
});

test("species balances handle partial harvests, deaths, missing counts and tonnes", async () => {
  const { speciesBalances, harvestWeightKg } = await import("../src/domain");
  const s = fixture();
  s.stocking = [
    {
      id: "s",
      cycleId: "c",
      species: "Rohu",
      category: "fish",
      date: "2026-01-01",
      count: 10000,
      averageGrams: 10,
      seedCost: 0,
      supplier: "",
    },
    {
      id: "s2",
      cycleId: "c",
      species: "Catla",
      category: "fish",
      date: "2026-01-01",
      count: 5000,
      averageGrams: 10,
      seedCost: 0,
      supplier: "",
    },
  ];
  const h = entry({
    kind: "harvest",
    species: "Rohu",
    quantity: 2.7,
    unit: "tonnes",
    harvestedCount: 3000,
    countApproximate: true,
    report: false,
  });
  s.entries = [
    h,
    entry({
      id: "d",
      kind: "observation",
      species: "Rohu",
      mortalityCount: 20,
      notes: "Observed deaths",
      report: false,
    }),
  ];
  assert.equal(harvestWeightKg(h), 2700);
  assert.equal(cropTotals(s, "c").harvestKg, 2700);
  assert.deepEqual(
    speciesBalances(s, "c").map((x) => [x.species, x.remaining, x.approximate]),
    [
      ["Rohu", 6980, true],
      ["Catla", 5000, false],
    ],
  );
  s.entries.push(
    entry({
      id: "h2",
      kind: "harvest",
      species: "Rohu",
      quantity: 500,
      report: false,
    }),
  );
  assert.equal(speciesBalances(s, "c")[0].remaining, null);
  assert.equal(speciesBalances(s, "c")[0].incomplete, true);
  assert.throws(
    () => assertEntry(s, { ...h, harvestedCount: 1.5 }),
    /invalidCount/,
  );
  assert.throws(
    () => assertEntry(s, { ...h, harvestedCount: 0 }),
    /invalidCount/,
  );
});

test("species options include saved names and deduplicate casing and spaces", async () => {
  const { speciesOptions } = await import("../src/domain");
  const s = fixture();
  s.speciesCatalog = [
    { name: "Local Fish", category: "fish" },
    { name: " rohu ", category: "fish" },
    { name: "Local Prawn", category: "prawn" },
  ];
  const fish = speciesOptions(s, "fish");
  assert.ok(fish.includes("Local Fish"));
  assert.equal(fish.filter((n) => n.trim().toLowerCase() === "rohu").length, 1);
  assert.ok(!fish.includes("Local Prawn"));
  assert.ok(speciesOptions(s, "prawn").includes("Local Prawn"));
});

test("feed bags convert to kg and defaults follow last saved entry", async () => {
  const { feedWeightKg, lastFeedDefaults, feedProductOptions } =
    await import("../src/domain");
  const s = fixture();
  const e = entry({
    kind: "feed",
    quantity: 2.5,
    unit: "bag",
    bagWeightKg: 25,
    product: "Feed A",
    report: false,
  });
  s.entries = [e];
  assertEntry(s, e);
  assert.equal(feedWeightKg(e), 62.5);
  assert.equal(cropTotals(s, "c").feedKg, 62.5);
  assert.deepEqual(lastFeedDefaults(s), {
    unit: "bag",
    product: "Feed A",
    bagWeight: "25",
  });
  assert.throws(
    () => assertEntry(s, { ...e, bagWeightKg: undefined }),
    /invalidBagWeight/,
  );
  assert.throws(
    () => assertEntry(s, { ...e, bagWeightKg: 0 }),
    /invalidBagWeight/,
  );
  s.entries.push(
    entry({
      id: "new",
      kind: "feed",
      quantity: 10,
      unit: "kg",
      product: "Feed B",
      report: false,
    }),
  );
  assert.equal(cropTotals(s, "c").feedKg, 72.5);
  assert.equal(lastFeedDefaults(s).unit, "kg");
  assert.equal(lastFeedDefaults(s).product, "Feed B");
  s.feedProducts = [" feed a "];
  assert.equal(feedProductOptions(s).length, 2);
});

test("30-day lab interval starts from an actual lab sample, never an old culture start", () => {
  const s=fixture();s.ponds[0].reportInterval=30;
  s.entries=[entry({report:false,date:"2026-10-27"})];
  assert.deepEqual(reportDue(s,s.ponds[0],"2026-10-27"),{last:null,due:null,overdueDays:null});
  s.entries.push(entry({date:"2026-10-20",report:true}));
  assert.deepEqual(reportDue(s,s.ponds[0],"2026-10-27"),{last:"2026-10-20",due:"2026-11-19",overdueDays:-23});
});
