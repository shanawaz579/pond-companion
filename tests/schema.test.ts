import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("new backend schema enforces organization boundaries and active crop uniqueness", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated;
 `);
    await db.exec(
      readFileSync("supabase/migrations/202610250001_initial.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250002_harvest_counts.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250003_species_catalog.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250004_feed_products.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250005_farm_expenses.sql",
        "utf8",
      ),
    );
    await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;grant select,insert on storage.objects to authenticated;
 insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
 set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`);
    const a = (
      await db.query<{ id: string }>(
        "select public.create_organization('Farm A') as id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.ponds(id,organization_id,name,location,area_acres,water_type) values('10000000-0000-4000-8000-000000000001',$1,'A','Canal',3,'fresh')",
      [a],
    );
    await db.query(
      "insert into public.cycles(id,organization_id,pond_id,name,start_date) values('20000000-0000-4000-8000-000000000001',$1,'10000000-0000-4000-8000-000000000001','First','2026-01-01')",
      [a],
    );
    await assert.rejects(
      db.query(
        "insert into public.cycles(id,organization_id,pond_id,name,start_date) values('20000000-0000-4000-8000-000000000002',$1,'10000000-0000-4000-8000-000000000001','Second','2026-01-01')",
        [a],
      ),
    );
    await db.exec(
      "set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002'",
    );
    const b = (
      await db.query<{ id: string }>(
        "select public.create_organization('Farm B') as id",
      )
    ).rows[0].id;
    assert.equal((await db.query("select * from public.ponds")).rows.length, 0);
    await assert.rejects(
      db.query(
        "insert into public.ponds(id,organization_id,name,location,area_acres,water_type) values('10000000-0000-4000-8000-000000000002',$1,'Hack','Canal',3,'fresh')",
        [a],
      ),
    );
    await assert.rejects(
      db.query(
        "insert into public.entries(id,organization_id,pond_id,cycle_id,kind,occurred_on,quantity) values('30000000-0000-4000-8000-000000000001',$1,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','feed','2026-01-02',5)",
        [b],
      ),
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
        [a + "/report.pdf"],
      ),
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('pond-documents',$1)",
      [b + "/report.pdf"],
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await db.exec(
      "set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001'",
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
