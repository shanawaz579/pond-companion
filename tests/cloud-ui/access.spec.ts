import { test, expect } from "@playwright/test";
const org = "10000000-0000-4000-8000-000000000001",
  user = "20000000-0000-4000-8000-000000000001",
  pond = "30000000-0000-4000-8000-000000000001",
  cycle = "40000000-0000-4000-8000-000000000001";
for (const role of ["admin", "worker"])
  test(
    role + " cloud access, feed persistence, sign out and language",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let state: any = {
        name: "Connected farm",
        revision: 0,
        role,
        ponds: [
          {
            id: pond,
            name: "Canal pond",
            location: "Village",
            area_acres: 3,
            water_type: "fresh",
            report_interval_days: 7,
            created_at: new Date().toISOString(),
          },
        ],
        cycles: [
          {
            id: cycle,
            pond_id: pond,
            name: "Current culture",
            start_date: "2026-01-01",
            closed_at: null,
          },
        ],
        stocking: [],
        entries: [],
        water_readings: [],
        attachments: [],
        farm_expenses: [],
        expense_attachments: [],
        species_catalog: [],
        feed_products: [],
      };
      const calls: any[] = [];
      let joined = role === "admin";
      let deleted: any[] = [];
      const team: any = { workers: [], invites: [] };
      await page.route("https://*.supabase.co/**", async (route) => {
        const url = new URL(route.request().url());
        let body: any = {};
        if (url.pathname.endsWith("/token")) {
          const token =
            Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
              "base64url",
            ) +
            "." +
            Buffer.from(
              JSON.stringify({
                sub: user,
                exp: Math.floor(Date.now() / 1000) + 3600,
              }),
            ).toString("base64url") +
            ".test";
          body = {
            access_token: token,
            refresh_token: "test-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: user,
              email: "farmer@example.com",
              aud: "authenticated",
              role: "authenticated",
              created_at: new Date().toISOString(),
            },
          };
        } else if (url.pathname.endsWith("/organizations"))
          body = joined
            ? [
                {
                  id: org,
                  name: state.name,
                  memberships: [
                    { role: role === "admin" ? "owner" : "worker" },
                  ],
                },
              ]
            : [];
        else if (url.pathname.endsWith("/join_worker_farm")) {
          joined = true;
          body = org;
        } else if (url.pathname.endsWith("/entry_trash_list"))
          body = deleted.map((e) => ({
            id: e.id,
            kind: e.kind,
            date: e.occurred_on,
            pond: "Canal pond",
            product: e.product,
            notes: e.notes,
            deleted_at: new Date().toISOString(),
          }));
        else if (url.pathname.endsWith("/set_entry_trashed")) {
          const req = route.request().postDataJSON();
          expect(req.expected_revision).toBe(state.revision);
          if (req.trashed) {
            deleted.push(state.entries.find((e: any) => e.id === req.entry));
            state.entries = state.entries.filter(
              (e: any) => e.id !== req.entry,
            );
          } else {
            state.entries.push(deleted.find((e) => e.id === req.entry));
            deleted = deleted.filter((e) => e.id !== req.entry);
          }
          state.revision++;
          body = null;
        } else if (url.pathname.endsWith("/team_read")) body = team;
        else if (url.pathname.endsWith("/create_worker_invite")) {
          const req = route.request().postDataJSON();
          expect(req.ponds).toEqual([pond]);
          team.invites = [
            {
              id: "invite",
              worker_name: req.worker_name,
              code: "ABCD1234EFGH5678",
              pond_ids: req.ponds,
              expires_at: "2026-11-03",
            },
          ];
          body = "ABCD1234EFGH5678";
        } else if (url.pathname.endsWith("/revoke_worker_invite")) {
          team.invites = [];
          body = null;
        } else if (url.pathname.endsWith("/farm_read")) body = state;
        else if (url.pathname.endsWith("/farm_save")) {
          const req = route.request().postDataJSON();
          calls.push(req);
          for (const k of [
            "entries",
            "water_readings",
            "feed_products",
            "species_catalog",
          ])
            state[k].push(
              ...(req.changes[k] || []).map((r: any) => ({
                ...r,
                created_at: new Date().toISOString(),
              })),
            );
          body = ++state.revision;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      await page.goto("/");
      await page
        .getByRole("button", { name: "New here? Create account", exact: true })
        .click();
      await expect(
        page.getByText("How will you use the app?", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "I work on a farm", exact: true })
        .click();
      await expect(
        page.getByText(/Your admin will give you an invitation code/),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Already have an account? Sign in",
          exact: true,
        })
        .click();
      await page
        .getByRole("textbox", { name: "Email", exact: true })
        .fill("farmer@example.com");
      await page.getByLabel("Password", { exact: true }).fill("test-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      if (role === "worker") {
        await page
          .getByRole("button", { name: "I work on a farm", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Create farm", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("textbox", { name: "Invitation code", exact: true })
          .fill("ABCD-1234-EFGH-5678");
        await page
          .getByRole("button", { name: "Join farm", exact: true })
          .click();
      }

      await expect(page.getByText(/No lab report recorded/)).toBeVisible();
      await expect(page.getByText(/days overdue/)).toHaveCount(0);
      await expect(
        page.getByText("On this phone · cloud not connected", { exact: true }),
      ).toHaveCount(0);
      if (role === "worker") {
        await expect(
          page.getByRole("button", { name: "Expenses", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Add pond", exact: true }),
        ).toHaveCount(0);
      } else
        await expect(
          page.getByRole("button", { name: "Expenses", exact: true }),
        ).toBeVisible();
      await page.getByRole("button", { name: /Canal pond/ }).click();
      if (role === "worker") {
        await expect(
          page.getByRole("button", { name: "Add stock", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Harvest", exact: true }),
        ).toHaveCount(0);
        await expect(page.getByText("Total cost", { exact: true })).toHaveCount(
          0,
        );
      }
      await page
        .getByRole("button", { name: "Gave feed", exact: true })
        .click();
      if (role === "worker")
        await expect(page.getByRole("textbox", { name: /Cost/ })).toHaveCount(
          0,
        );
      await page
        .getByRole("textbox", { name: "Quantity", exact: true })
        .fill("5");
      await page
        .getByRole("button", { name: "Review entry", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save to farm", exact: true })
        .click();
      await expect(
        page.getByText("Saved to farm", { exact: true }),
      ).toBeVisible();
      expect(calls.at(-1).changes.entries[0].quantity).toBe(5);
      expect(calls.at(-1).changes.entries[0].cost).toBe(0);
      await page.getByRole("tab", { name: "Records", exact: true }).click();
      await page.getByRole("button", { name: /^Gave feed Canal pond/ }).click();
      if (role === "admin") {
        await page
          .getByRole("button", { name: "Move to Trash", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Confirm deletion", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: /^Gave feed Canal pond/ }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await page.getByRole("button", { name: "Trash", exact: true }).click();
        await page
          .getByRole("button", { name: "Restore", exact: true })
          .click();
        await expect(
          page.getByText("Trash is empty.", { exact: true }),
        ).toBeVisible();
        expect(state.entries).toHaveLength(1);
        await page.getByRole("button", { name: "Back", exact: true }).click();
      } else
        await expect(
          page.getByRole("button", { name: "Move to Trash", exact: true }),
        ).toHaveCount(0);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      if (role === "admin") {
        await page.getByRole("button", { name: "Team", exact: true }).click();
        await page
          .getByRole("button", { name: "Add worker", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "Worker name", exact: true })
          .fill("Ravi");
        await page
          .getByRole("switch", { name: "Canal pond", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Create invitation", exact: true })
          .click();
        await expect(
          page.getByText("ABCD-1234-EFGH-5678", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Cancel invitation", exact: true })
          .click();
        await expect(
          page.getByText("ABCD-1234-EFGH-5678", { exact: true }),
        ).toHaveCount(0);
        await page.getByRole("button", { name: "Back", exact: true }).click();
      } else
        await expect(
          page.getByRole("button", { name: "Team", exact: true }),
        ).toHaveCount(0);

      if (role === "worker") {
        await expect(
          page.getByRole("button", { name: "Team", exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Export/ })).toHaveCount(
          0,
        );
      } else
        await expect(
          page.getByRole("button", { name: "Team", exact: true }),
        ).toBeVisible();
      await page.getByRole("button", { name: "తెలుగు", exact: true }).click();
      await page
        .getByRole("button", { name: "లాగ్ అవుట్", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Sign in", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Canal pond", { exact: true })).toHaveCount(
        0,
      );
      expect(errors).toEqual([]);
    },
  );

test("owner signup records onboarding choice without granting farm permissions", async ({
  page,
}) => {
  let signup: any;
  await page.route("https://*.supabase.co/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/signup"))
      signup = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: user }, session: null }),
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New here? Create account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "I manage a farm", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Check your email to confirm your account, then sign in.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(signup.data.onboarding_role).toBe("owner");
  expect(signup.data.role).toBeUndefined();
});
