import { test, expect } from "@playwright/test";
const consoleErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page)).toEqual([]);
});
test("farmer can set up a pond and mixed crop, save feed, switch languages and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Add pond", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Pond name", exact: true })
    .fill("Canal pond");
  await page
    .getByRole("textbox", { name: "Village or landmark" })
    .fill("East canal");
  await page
    .getByRole("textbox", { name: "Area (acres)", exact: true })
    .fill("3.5");
  await page
    .getByRole("textbox", { name: "Lab report interval (days) · optional" })
    .fill("7");
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start a culture period", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Culture period name", exact: true }),
  ).toHaveCount(0);
  const currentDate = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue(
    currentDate,
  );
  await expect(page.getByLabel("Start date", { exact: true })).toHaveAttribute(
    "type",
    "date",
  );
  await page.getByLabel("Start date", { exact: true }).fill("2026-01-01");
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  const storedCycle = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("pond-companion-local-v1")!).cycles[0],
  );
  expect(storedCycle.name).toBe("Canal pond");
  expect(storedCycle.startDate).toBe("2026-01-01");
  for (const species of ["Rohu", "Scampi"]) {
    await page
      .getByRole("button", { name: "Add fish / prawns", exact: true })
      .click();
    if (species === "Scampi")
      await page.getByRole("radio", { name: "Prawns", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Species name", exact: true })
      .fill(species);
    await page
      .getByRole("button", { name: `Select: ${species}`, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Number stocked", exact: true })
      .fill("1000");
    await page
      .getByRole("button", { name: "Save on this phone", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Gave feed", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quantity", exact: true })
    .fill("12.5");
  await page
    .getByRole("textbox", { name: "Feed brand / product" })
    .fill("Feed A");
  await page
    .getByRole("button", { name: "Add new feed: Feed A", exact: true })
    .click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(page.getByText("12.5 kg", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page.reload();
  await expect(page.getByText("Canal pond", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Records", exact: true }).click();
  await expect(page.getByText("Feed A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByText("भाषा", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "తెలుగు", exact: true }).click();
  await expect(page.getByText("భాష", { exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/settings-telugu.png", fullPage: true });
});

test("water PDF persists, updates only report date, and treatment requires actual amount", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "pond-companion-local-v1",
      JSON.stringify({
        version: 1,
        language: "en",
        farmName: "Pilot farm",
        revision: 0,
        ponds: [
          {
            id: "p",
            name: "Pond A",
            location: "Canal side",
            area: 3,
            waterType: "fresh",
            reportInterval: 7,
            createdAt: "",
          },
        ],
        cycles: [
          { id: "c", pondId: "p", name: "Crop A", startDate: "2026-01-01" },
        ],
        stocking: [],
        entries: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Pond A, Canal side" }).click();
  await page.getByRole("button", { name: "Water test", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-01-02");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose PDF", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "water-report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await expect(
    page.getByText("water-report.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("switch", { name: "This includes a laboratory report" })
    .check();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pond-companion-local-v1")!),
  );
  expect(stored.entries[0].attachments[0].uri).toContain(
    "data:application/pdf",
  );
  expect(stored.entries[0].date).toBe("2026-01-02");
  expect(stored.entries[0].report).toBe(true);
  await page.getByRole("button", { name: "Pond A, Canal side" }).click();
  await page
    .getByRole("button", { name: "Used medicine / input", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Product / item name", exact: true })
    .fill("Product label");
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(
    page.getByText("Enter a valid amount greater than zero.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Quantity", exact: true }).fill("2");
  await page.getByRole("radio", { name: "litres", exact: true }).click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(page.getByText("2 litres", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 780 });
  await page.screenshot({ path: "docs/home-english.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("harvest count stays simple, normalizes tonnes, and shows incomplete balances", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "pond-companion-local-v1",
      JSON.stringify({
        version: 1,
        language: "en",
        farmName: "Test",
        revision: 0,
        ponds: [
          {
            id: "p",
            name: "Mixed pond",
            location: "Canal",
            area: 3,
            waterType: "fresh",
            reportInterval: null,
            createdAt: "",
          },
        ],
        cycles: [
          { id: "c", pondId: "p", name: "Crop", startDate: "2026-01-01" },
        ],
        stocking: [
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
        ],
        entries: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Mixed pond, Canal" }).click();
  await page.getByRole("button", { name: "Harvested", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Total harvested weight", exact: true })
    .fill("2.7");
  await page.getByRole("radio", { name: "tonnes", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Number harvested · optional", exact: true })
    .fill("3000");
  await page.getByRole("switch", { name: "This count is approximate" }).check();
  await page.getByRole("radio", { name: "Rohu", exact: true }).click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(
    page.getByText("Calculated average fish weight: ≈ 0.9 kg", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await expect(
    page.getByText("Estimated remaining count: ≈ 7,000", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Harvested", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Total harvested weight", exact: true })
    .fill("500");
  await page.getByRole("radio", { name: "Rohu", exact: true }).click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await expect(
    page.getByText("Remaining count incomplete — a harvest has no count.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mixed pond, Canal" }).click();
  await expect(
    page.getByText("Remaining count incomplete — a harvest has no count.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("create species, reuse after reload, and filter by fish or prawn", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "pond-companion-local-v1",
      JSON.stringify({
        version: 1,
        language: "en",
        farmName: "Test",
        revision: 0,
        ponds: [
          {
            id: "p",
            name: "Mixed pond",
            location: "Canal",
            area: 3,
            waterType: "fresh",
            reportInterval: null,
            createdAt: "",
          },
        ],
        cycles: [
          { id: "c", pondId: "p", name: "Crop", startDate: "2026-01-01" },
        ],
        stocking: [],
        entries: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Mixed pond, Canal" }).click();
  await page
    .getByRole("button", { name: "Add fish / prawns", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Species name", exact: true })
    .fill("Local Fish");
  await page
    .getByRole("button", { name: "Add new species: Local Fish", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Change species: Local Fish" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mixed pond, Canal" }).click();
  await page
    .getByRole("button", { name: "Add fish / prawns", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Species name", exact: true })
    .fill(" local   fish ");
  await expect(
    page.getByRole("button", { name: "Select: Local Fish", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add new species:/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Select: Local Fish", exact: true })
    .click();
  await page.getByRole("radio", { name: "Prawns", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Change species: Local Fish" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Select: Scampi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select: Local Fish", exact: true }),
  ).toHaveCount(0);
});

test("feed bags, reusable brand, and last-used defaults survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "pond-companion-local-v1",
      JSON.stringify({
        version: 1,
        language: "en",
        farmName: "Test",
        revision: 0,
        ponds: [
          {
            id: "p",
            name: "Feed pond",
            location: "Canal",
            area: 3,
            waterType: "fresh",
            reportInterval: null,
            createdAt: "",
          },
        ],
        cycles: [
          { id: "c", pondId: "p", name: "Crop", startDate: "2026-01-01" },
        ],
        stocking: [],
        entries: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Feed pond, Canal" }).click();
  await page.getByRole("button", { name: "Gave feed", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quantity", exact: true })
    .fill("2.5");
  await page.getByRole("radio", { name: "Bags", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Feed brand / product", exact: true })
    .fill("Pond Feed");
  await page
    .getByRole("button", { name: "Add new feed: Pond Feed", exact: true })
    .click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(
    page.getByText("Enter a valid weight per bag in kg.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Weight per bag (kg)", exact: true })
    .fill("25");
  await expect(
    page.getByText("Total feed (kg): 62.5", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(
    page.getByText("Weight per bag (kg): 25 · Total feed (kg): 62.5", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Feed pond, Canal" }).click();
  await page.getByRole("button", { name: "Gave feed", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Bags", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Change feed: Pond Feed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Weight per bag (kg)", exact: true }),
  ).toHaveValue("25");
  await page.getByRole("textbox", { name: "Quantity", exact: true }).fill("10");
  await page.getByRole("radio", { name: "kg", exact: true }).click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await page.getByRole("button", { name: "Gave feed", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "kg", exact: true }),
  ).toBeChecked();
});

test("FIFO deductions and shared expenses work without duplicate costs", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "pond-companion-local-v1",
      JSON.stringify({
        version: 1,
        language: "en",
        farmName: "Test",
        revision: 0,
        ponds: [
          {
            id: "p",
            name: "Mixed pond",
            location: "Canal",
            area: 3,
            waterType: "fresh",
            reportInterval: null,
            createdAt: "",
          },
        ],
        cycles: [
          {
            id: "c",
            pondId: "p",
            name: "Ongoing culture",
            startDate: "2026-01-01",
          },
        ],
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
            seedCost: 0,
            supplier: "",
          },
        ],
        entries: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Mixed pond, Canal" }).click();
  await page.getByRole("button", { name: "Harvested", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Total harvested weight", exact: true })
    .fill("4000");
  await page
    .getByRole("textbox", { name: "Number harvested · optional", exact: true })
    .fill("4000");
  await page.getByRole("radio", { name: "Rohu", exact: true }).click();
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await expect(
    page.getByText("2026-01-01: 3,000", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2026-03-01: 1,000", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await expect(
    page.getByText("Batch remaining (estimated): 0", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Batch remaining (estimated): 4,000", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add fish / prawns", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(
    page.getByText("Total farm expenses: ₹1,000", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Whole farm / Shared", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "Electricity", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Amount (₹)", exact: true })
    .fill("200");
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await expect(
    page.getByText("Total farm expenses: ₹1,200", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByRole("radio", { name: "Mixed pond", exact: true }).click();
  await page.getByRole("radio", { name: "Labour", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Amount (₹)", exact: true })
    .fill("300");
  await page.getByRole("button", { name: "Review entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Save on this phone", exact: true })
    .click();
  await expect(
    page.getByText("Total farm expenses: ₹1,500", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mixed pond", exact: true }).click();
  await expect(
    page.getByText("Direct pond expenses: ₹1,300", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(
    page.getByText("Total farm expenses: ₹1,500", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Shared expenses: ₹200", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/expenses.png", fullPage: true });
});
