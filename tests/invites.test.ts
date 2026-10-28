import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("team invitations: admin scope, single use, assigned ponds, revocation, expiry and removal", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated;`,
    );
    await db.exec(readFileSync("supabase/setup.sql", "utf8"));
    const owner = randomUUID(),
      worker = randomUUID(),
      other = randomUUID(),
      p = randomUUID(),
      p2 = randomUUID();
    await db.query("insert into auth.users values ($1),($2),($3)", [
      owner,
      worker,
      other,
    ]);
    const as = async (id: string) =>
      db.exec(
        `reset role;set role authenticated;set request.jwt.claim.sub='${id}'`,
      );
    await as(owner);
    const org = (
      await db.query<{ id: string }>(
        "select public.create_organization('Farm') id",
      )
    ).rows[0].id;
    const org2 = (
      await db.query<{ id: string }>(
        "select public.create_organization('Other') id",
      )
    ).rows[0].id;
    await db.exec("reset role");
    await db.query(
      "insert into public.ponds(id,organization_id,name,location,area_acres,water_type) values($1,$2,'Pond','Village',3,'fresh'),($3,$4,'Other pond','Village',2,'fresh')",
      [p, org, p2, org2],
    );
    await as(owner);
    const invite = async () =>
      (
        await db.query<{ code: string }>(
          "select public.create_worker_invite($1,$2,$3) code",
          [org, "Ravi", [p]],
        )
      ).rows[0].code;
    await assert.rejects(
      db.query("select public.create_worker_invite($1,$2,$3)", [
        org,
        "Ravi",
        [p2],
      ]),
      /Wrong pond/,
    );
    const code = await invite();
    await as(worker);
    await assert.rejects(
      db.query("select public.team_read($1)", [org]),
      /Admin required/,
    );
    await assert.rejects(
      db.query("select public.create_worker_invite($1,$2,$3)", [
        org,
        "Fake",
        [p],
      ]),
      /Admin required/,
    );
    await db.query("select public.join_worker_farm($1)", [
      code.toLowerCase().match(/.{4}/g)!.join("-"),
    ]);
    const data = (
      await db.query<{ data: any }>("select public.farm_read($1) data", [org])
    ).rows[0].data;
    assert.equal(data.role, "worker");
    assert.deepEqual(
      data.ponds.map((v: any) => v.id),
      [p],
    );
    await as(other);
    await assert.rejects(
      db.query("select public.join_worker_farm($1)", [code]),
      /unavailable/,
    );
    await as(owner);
    const team = (
      await db.query<{ data: any }>("select public.team_read($1) data", [org])
    ).rows[0].data;
    assert.equal(team.workers[0].name, "Ravi");
    assert.deepEqual(team.workers[0].ponds, [p]);
    assert.equal(team.invites.length, 0);
    const cancelled = await invite();
    const pending = (
      await db.query<{ data: any }>("select public.team_read($1) data", [org])
    ).rows[0].data;
    await db.query("select public.revoke_worker_invite($1,$2)", [
      org,
      pending.invites[0].id,
    ]);
    const expired = await invite();
    await db.exec("reset role");
    await db.query(
      "update public.worker_invites set expires_at=now()-interval '1 day' where code=$1",
      [expired],
    );
    await as(other);
    for (const invalid of [cancelled, expired, "BAD"])
      await assert.rejects(
        db.query("select public.join_worker_farm($1)", [invalid]),
        /unavailable/,
      );
    await as(owner);
    await db.query("select public.remove_worker($1,$2)", [org, worker]);
    await as(worker);
    await assert.rejects(
      db.query("select public.farm_read($1)", [org]),
      /Access denied/,
    );
  } finally {
    await db.close();
  }
});
