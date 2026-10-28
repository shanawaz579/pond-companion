import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { emptyState, State } from "../src/domain";
import { decodeFarm, encodeChanges } from "../src/cloudMapping";
test("cloud RPC: atomic saves, concurrent edits, worker redaction, pond isolation, receipts and historical import", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;grant select,insert on storage.objects to authenticated;`);
    const setup = readFileSync("supabase/setup.sql", "utf8");
    for (const f of readdirSync("supabase/migrations").sort()) {
      const migration = readFileSync("supabase/migrations/" + f, "utf8")
        .replace(/^begin;\s*$/gm, "")
        .replace(/^commit;\s*$/gm, "");
      assert.ok(
        setup.includes(migration),
        "Setup bundle must include current " + f,
      );
    }
    await db.exec(setup);
    await db.exec(
      "grant select on all tables in schema public to authenticated",
    );
    const owner = randomUUID(),
      worker = randomUUID(),
      outsider = randomUUID();
    await db.query("insert into auth.users values ($1),($2),($3)", [
      owner,
      worker,
      outsider,
    ]);
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}'`,
    );
    const org = (
      await db.query<{ id: string }>(
        "select public.create_organization('Farm') id",
      )
    ).rows[0].id;
    const p = randomUUID(),
      p2 = randomUUID(),
      c = randomUUID(),
      old = randomUUID();
    const s: State = {
      ...emptyState,
      farmName: "Farm",
      language: "en",
      ponds: [
        {
          id: p,
          name: "Pond",
          location: "Village",
          area: 3,
          waterType: "fresh",
          reportInterval: 7,
          createdAt: new Date().toISOString(),
        },
        {
          id: p2,
          name: "Private pond",
          location: "Village",
          area: 2,
          waterType: "fresh",
          reportInterval: null,
          createdAt: new Date().toISOString(),
        },
      ],
      cycles: [
        {
          id: old,
          pondId: p,
          name: "Old",
          startDate: "2025-01-01",
          closedAt: "2025-12-30T12:00:00Z",
        },
        { id: c, pondId: p, name: "New", startDate: "2026-01-01" },
      ],
      stocking: [
        {
          id: randomUUID(),
          cycleId: c,
          species: "Rohu",
          category: "fish",
          date: "2026-01-01",
          count: 100,
          averageGrams: 50,
          seedCost: 450,
          supplier: "Secret supplier",
        },
        {
          id: randomUUID(),
          cycleId: old,
          species: "Rohu",
          category: "fish",
          date: "2025-01-02",
          count: 50,
          averageGrams: 30,
          seedCost: 200,
          supplier: "",
        },
      ],
      expenses: [
        {
          id: randomUUID(),
          pondId: p,
          category: "labour",
          date: "2026-01-02",
          amount: 999,
          notes: "Private receipt",
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const save = async (rev: number, changes: any) =>
      (
        await db.query<{ rev: number }>(
          "select public.farm_save($1,$2,$3::jsonb) rev",
          [org, rev, JSON.stringify(changes)],
        )
      ).rows[0].rev;
    const read = async () =>
      (await db.query<{ data: any }>("select public.farm_read($1) data", [org]))
        .rows[0].data;
    assert.equal(
      await save(
        0,
        encodeChanges({ ...emptyState, farmName: "Farm" }, s, randomUUID),
      ),
      1,
    );
    let full = decodeFarm(await read(), "en");
    assert.equal(full.stocking.length, 2);
    assert.equal(full.expenses?.[0].amount, 999);
    await assert.rejects(save(0, { name: "Stale" }), /FARM_CONFLICT/);
    await db.query("select public.set_worker($1,$2,$3::uuid[])", [
      org,
      worker,
      [p],
    ]);
    await db.exec(`set request.jwt.claim.sub='${worker}'`);
    const redacted = await read();
    assert.equal(redacted.ponds.length, 1);
    assert.equal(redacted.farm_expenses.length, 0);
    assert.equal(redacted.expense_attachments.length, 0);
    assert.equal(redacted.stocking[0].seed_cost, undefined);
    assert.equal(redacted.stocking[0].supplier, undefined);
    assert.equal(
      (await db.query("select * from public.stocking")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.farm_expenses")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update public.organizations set name='Hack'"),
    );
    await assert.rejects(save(2, { farm_expenses: [{}] }), /Admin required/);
    await assert.rejects(save(2, { stocking: [{}] }), /Admin required/);
    const base = decodeFarm(redacted, "en");
    const e = {
      id: randomUUID(),
      pondId: p,
      cycleId: c,
      kind: "feed" as const,
      date: "2026-01-02",
      createdAt: new Date().toISOString(),
      product: "Feed",
      quantity: 2,
      bagWeightKg: 25,
      unit: "bag",
      cost: 0,
      revenue: 0,
      species: "",
      notes: "Fed",
      readings: [],
      attachments: [
        {
          id: randomUUID(),
          uri: "cloud:" + org + "/entries/" + p + "/report",
          name: "report.pdf",
          mime: "application/pdf",
        },
      ],
      report: false,
    };
    await assert.rejects(
      save(
        2,
        encodeChanges(
          base,
          { ...base, entries: [{ ...e, cost: 500 }] },
          randomUUID,
        ),
      ),
      /Admin required/,
    );
    await assert.rejects(
      save(
        2,
        encodeChanges(
          base,
          { ...base, entries: [{ ...e, pondId: p2 }] },
          randomUUID,
        ),
      ),
      /Pond not assigned/,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
      [org + "/entries/" + p + "/report"],
    );
    assert.equal(
      await save(2, encodeChanges(base, { ...base, entries: [e] }, randomUUID)),
      3,
    );
    const after = await read();
    assert.equal(after.entries[0].created_by, worker);
    assert.equal(after.entries[0].cost, undefined);
    assert.equal(after.attachments.length, 1);
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select public.can_read_pond_file($1) ok",
          [org + "/entries/" + p + "/report"],
        )
      ).rows[0].ok,
      true,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
        [org + "/expenses/receipt"],
      ),
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
        [org + "/entries/" + p2 + "/file"],
      ),
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
      [org + "/entries/" + p + "/file"],
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
      "only the linked report is readable; orphan files remain hidden",
    );
    // A failed count update must roll back the entire transaction.
    const current = decodeFarm(after, "en");
    const bad = {
      ...e,
      id: randomUUID(),
      kind: "observation" as const,
      quantity: null,
      species: "Rohu",
      mortalityCount: 101,
      attachments: [],
    };
    await assert.rejects(
      save(
        3,
        encodeChanges(
          current,
          { ...current, entries: [...current.entries, bad] },
          randomUUID,
        ),
      ),
      /Stock count exceeded/,
    );
    assert.equal((await read()).revision, 3);
    // Trash preserves attachments, enforces admin access and revision checks.
    const trash = async (id: string, removed: boolean, revision: number) =>
      db.query("select public.set_entry_trashed($1,$2,$3,$4)", [
        org,
        id,
        removed,
        revision,
      ]);
    await assert.rejects(trash(e.id, true, 3), /Admin required/);
    await assert.rejects(
      db.query("select public.entry_trash_list($1)", [org]),
      /Admin required/,
    );
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    await assert.rejects(trash(e.id, true, 2), /FARM_CONFLICT/);
    await assert.rejects(trash(randomUUID(), true, 3), /Entry not found/);
    await trash(e.id, true, 3);
    assert.equal((await read()).entries.length, 0);
    assert.equal((await read()).attachments.length, 0);
    assert.equal(
      (
        await db.query<{ data: any }>(
          "select public.entry_trash_list($1) data",
          [org],
        )
      ).rows[0].data.length,
      1,
    );
    await db.exec(`set request.jwt.claim.sub='${worker}'`);
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select public.can_read_pond_file($1) ok",
          [org + "/entries/" + p + "/report"],
        )
      ).rows[0].ok,
      false,
    );
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    await trash(e.id, false, 4);
    assert.equal((await read()).entries.length, 1);
    assert.equal((await read()).attachments.length, 1);
    const death = { ...bad, id: randomUUID(), mortalityCount: 60 };
    let live = decodeFarm(await read(), "en");
    await save(
      5,
      encodeChanges(
        live,
        { ...live, entries: [...live.entries, death] },
        randomUUID,
      ),
    );
    await trash(death.id, true, 6);
    live = decodeFarm(await read(), "en");
    await save(
      7,
      encodeChanges(
        live,
        { ...live, entries: [...live.entries, { ...death, id: randomUUID() }] },
        randomUUID,
      ),
    );
    await assert.rejects(trash(death.id, false, 8), /Stock count exceeded/);
    assert.equal((await read()).revision, 8);
    assert.equal(
      (
        await db.query<{ data: any }>(
          "select public.entry_trash_list($1) data",
          [org],
        )
      ).rows[0].data.length,
      1,
    );
    await db.exec(`set request.jwt.claim.sub='${outsider}'`);
    await assert.rejects(read(), /Access denied/);
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    await db.query("select public.set_worker($1,$2,$3::uuid[])", [
      org,
      worker,
      [],
    ]);
    await db.exec(`set request.jwt.claim.sub='${worker}'`);
    assert.equal((await read()).ponds.length, 0);
  } finally {
    await db.close();
  }
});
