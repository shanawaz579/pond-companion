# Initial pilot verification

- Final TypeScript check: passed.
- Eight domain tests cover sample-date reminders, manual-vs-lab distinction, closed crops, invalid quantities/dates, cross-pond entry rejection, treatment/report validation, harvest economics and translation-key parity.
- Android Metro/Hermes export: passed (not an APK).
- Two browser workflow tests passed with zero browser console errors: pond setup, mixed fish/prawn stocking, feed review/save, reload persistence, language switching, PDF retention, sample-date retention, treatment quantity validation and narrow layout. English and Telugu screenshots visually inspected.
- Supabase migration: successfully executed in an embedded PostgreSQL test with mocked auth/storage schemas. RLS tests passed for cross-organisation reads/writes, cross-crop references, storage isolation and one active crop per pond. This is not a Supabase integration test; repeat in a disposable separate Supabase project before deployment.
- Real Android device: pending. Verify camera permission, gallery, multi-page PDF, SQLite reopen, attachment reopen after restart, notification delivery, exported ZIP recovery, TalkBack, large font and weak-network behaviour.

Do not claim cloud sync, AI, physical device validation or signed app delivery from a successful JS export.

## Dependency audit
The Expo CLI dependency chain currently reports high-severity advisories for node-forge (signature verification) and Zod (oversized collection validation). These are development-tool dependencies pulled through Expo; no application AI or upload API uses them. The registry currently supplies node-forge 1.4.0 without a patched release. Do not apply npm audit’s proposed downgrade to Expo 44. Before production signing/cloud deployment, recheck upstream fixes and validate any compatible override. This local pilot is not production release approval.

## Species stock update
Ten domain/schema tests and three browser workflows passed, including tonnes conversion, approximate counts, species isolation, death subtraction and unknown-count handling after reload. Harvest records without counts are intentionally incomplete; no count is inferred from weight alone.

## Creatable species selector
Species catalog persists independently of stocking, includes prior stocking names, filters by fish/prawn category, and prevents casing/whitespace duplicates. Domain coverage and a browser workflow exercise custom creation, reload/reuse and category changes. No existing pond data is reset.

## Feed bags and products
Bag conversions, invalid bag weights, mixed-unit totals and last-saved defaults covered by domain tests. Browser workflow verifies create/reuse brand, bag conversion review, reload persistence and switching back to kg. Defaults are based on the last saved feed entry on this device; cancelled drafts do not change them.

## Continuous culture and expenses
16 domain/schema tests and 6 browser workflows pass. Coverage includes partial FIFO harvest, later restocking, species separation, unknown counts, future-stock exclusion, backdated overdrafts, shared/direct expenses, legacy cost inclusion once, reload persistence and receipt backup collection. Expense screen visually inspected. Current FIFO allocations are derived from dated source records; transfers/manual allocation remain future work.

## Supabase integration — 2026-10-27
- TypeScript and ESLint pass. 17 domain/PostgreSQL tests pass, including the generated single-transaction setup bundle, farm isolation, role redaction, assigned ponds, denied raw writes, conflicting revisions, atomic rollback on stock overdraw, closed-period import, linked private-file visibility and hidden orphan files.
- 2 mocked cloud browser workflows pass: admin and worker sign-in, role-specific screens, feeding saved through the RPC mapping, Telugu language selection, and sign-out clearing farm UI.
- 6 existing local browser workflows pass against an isolated production web export on port 8093. Expo 58 development virtual environment modules still loaded `.env.local` despite the CLI environment-loading opt-out; production export with empty public variables isolates local regression tests without changing the user's credentials.
- Android JS/Hermes export passes. No APK, emulator or physical-device test performed.
- Live Supabase remains **not deployed**: REST returned 404/PGRST205 for organizations. `supabase/setup.sql` is ready for the user to run in the new empty pond project. Real email confirmation, authenticated writes and Storage API upload/download must be smoke-tested after setup; mocked browser/PGlite checks are not a substitute.
- Cloud writes currently require internet. No offline queue, approval workflow, password recovery UI or email staff invitations. Failed pre-commit uploads can leave private orphan objects for later cleanup.

### Live setup follow-up — 2026-10-27
User confirmed SQL execution. Live REST checks: organizations HTTP 200 with no anonymous rows; farm_read/farm_save exist and reject anonymous access; farm_read message "Access denied". Email authentication endpoint HTTP 200, email enabled. App preview HTTP 200. Authenticated saving and Storage API round-trip remain unverified until user signs in. This supersedes the earlier not-deployed status above.

## Date selection and culture setup — 2026-10-27
- Removed manual culture-name entry; new periods use the pond name without a date suffix.
- Shared date field covers culture start, stocking, every daily record (including reports/harvest) and expenses. New forms default to local today. Android uses the system date dialog; web uses the browser calendar. Today is the maximum; stocking and daily entries also enforce culture start as minimum. ISO storage stays unchanged; native date conversion uses local components.
- Six browser workflows pass, including today's default, historical culture/report selection, automatic culture naming and saved-date persistence. TypeScript, ESLint and Android JS/Hermes export pass. Native picker interactions require a physical-device smoke test/new development build.
