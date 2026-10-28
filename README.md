# Pond Companion — Android cloud pilot

A separate fish/prawn pond app. This repository and its Supabase project are independent of IB Fresh Fish Tools. Working product name and Android package are provisional.

## What works now
- English, Telugu and Hindi UI, including validation and save messages.
- Any number of ponds, locations, areas and configurable lab-report intervals.
- Ongoing culture periods, multiple stocking batches and mixed fish/prawn species. Partial harvests keep the period open. Known harvest/death counts deduct from oldest eligible batches, with source records retained and a harvest allocation preview. Future stocking cannot cover earlier removals; backdated removals that overdraw stock are rejected.
- Searchable species selection with reusable custom names, fish/prawn filtering and case/whitespace duplicate prevention.
- Feed entries accept kg or bags (including partial bags), with required kg per bag and normalized kg totals. Feed brands/products are searchable and creatable; last saved brand/unit defaults persist across restarts.
- Feeding, treatments, observations, manual water readings, expenses, growth sample weights and partial harvests.
- Harvest weight in kg/tonnes, optional species counts with an approximate flag, calculated average weight, recorded death counts and per-species remaining-count estimates. Missing harvest counts show incomplete balances; transfers are not yet recorded.
- Camera/gallery photos and PDF attachments for treatments and reports; originals copied into app-private storage on Android.
- Separate expense form defaults to Whole farm / Shared, with pond selection, categories and receipts. One expense history includes original seed/feed/treatment costs once; shared expenses remain unallocated. Pond expenses link to the culture period covering the expense date when one exists.
- Review before saving, transactional Supabase saves, culture totals and history. Earlier local SQLite/browser records remain available for explicit import or backup.
- Due/overdue lab-report cards using sample dates; opt-in local notification per active pond, refreshed when records change or the app opens.
- ZIP backup export with records and attachment files.

## Run
Node 24 is installed as a project-local development dependency to avoid changing the machine's Node version. Standard Node 24 also works with `npx expo start`.

```sh
npm install
npm start
npm run android
npm run web
npm run typecheck
npm test
npm run test:ui
npm run export:android
```

The Android command needs an Android emulator or connected device. Use an Expo development build for device validation, especially notifications. `export:android` produces a compiled JS/Hermes bundle, not an installable APK.

## APK / Play release
`eas.json` includes an internal APK profile and production AAB profile. When an Expo account and signing setup are available:

```sh
npx eas-cli build --platform android --profile preview
```

No cloud build, signing, Play submission or deployment has been performed. No Android SDK/emulator was detected during initial setup. Camera and notifications require testing on a real Android device.

## Data and backups
All records are local in this pilot. Android uses SQLite; the browser preview uses localStorage and data URLs. Camera/library attachments are copied into private document storage. Data survives normal restarts but can be lost on uninstall, cleared storage or device loss. Export ZIP backups from Settings. Restore UI is not implemented yet; ZIP contains portable JSON and files for manual recovery. Large backups currently assemble in memory; production will need a streaming implementation.

Do not use the browser preview as primary long-term storage. Failed saves show an error rather than a success message. Drafts survive review/back but are not restored after process termination. A cancelled attachment draft can leave unreferenced local files; cleanup is a follow-up.

## Separate Supabase setup later
1. In the **new pond-companion Supabase project**, run `supabase/setup.sql` once in SQL Editor. This generated bundle wraps all six migrations in one transaction. Do not run it in the trading project or over an already-migrated database. For later updates, apply only unapplied migrations. Regenerate with `node scripts/build-supabase-setup.mjs` after migration edits.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, then restart Expo. Never put a secret/service-role key or database password in the mobile app.
3. Create an account, confirm the email if required, then sign in and create your farm. The farm creator is its admin. Workers create their own accounts and share their account ID; the admin assigns ponds in Settings. Clearing all assignments removes pond access.
4. For earlier records on this device, an admin can import them into an empty farm from Settings. The original local copy is retained. Import may reject inconsistent historical stock counts; export the original ZIP before correcting records.

Cloud mode requires internet to load and save. Failed saves keep the current draft on screen; drafts do not survive process termination. There is no offline write queue, automatic merge, or realtime subscription. Refresh farm fetches other users' changes. A stale save is rejected by a farm revision check; refresh and review before retrying. Data and attachments are not silently uploaded before signing in and choosing/importing into a farm.

Financial tables, expenses, receipts and audit records are admin-only. Workers receive only assigned pond data through a server-side redacting function, and may record feed, treatment, water, observations/deaths and growth. Stocking and harvest entry are admin-only for now; no approval queue is implemented. Original entries are append-only. Direct database writes are revoked from app users; authenticated RPC functions enforce membership, assignments, author identity, transaction boundaries and count limits. Photos/PDFs use a private bucket and 60-second signed URLs. Failed transactions after upload can leave private orphan files; maintenance cleanup is future work.

Authentication uses Supabase email/password with native sessions in SecureStore. Farm data stays in memory in cloud mode and clears on sign-out; local reminder schedules are cleared on farm/account changes. Web sessions use the Supabase browser storage implementation. Password recovery, email invitations and a richer staff directory are future work. Configure authentication email delivery/confirmation URLs for release. No live end-to-end test has been performed until the database setup and a real test account are available.

No Supabase configuration means legacy local pilot mode. Local UI regression tests use an isolated production web export on port 8093 with empty public configuration; cloud UI tests on port 8092 mock HTTP responses and create no real accounts.

## Scope limits
- This is a cloud integration pilot, not a finished commercial release. The initial farm load fetches the complete farm dataset; pagination is needed for large histories.
- AI extraction/explanation, ESP integration, trading links, email invitations, purchases/inventory ledger and full medication follow-up workflows are not implemented.
- Lab reminder interval is a farmer/advisor configuration, not an agronomic recommendation. Manual parameter readings do not reset the lab-report schedule. Parameter-specific schedules are future work.
- Notifications are one next reminder per pond, not an indefinitely repeating service. Disabled OS notifications, force-stop and battery restrictions can affect delivery. In-app due states remain visible.
- Costs and sales reflect recorded cash amounts only. Shared cost allocation, species margins and full profitability accounting are future work.
- Telugu/Hindi copy needs native-speaking farmer review. Native TalkBack, enlarged text, outdoor readability, camera and restart persistence still need physical-device validation.

See `docs/ACCEPTANCE.md` for verification evidence and remaining release checks.

FIFO is a count-accounting assumption: actual fish can mix. Missing harvest counts make balances incomplete. Transfers and manual batch allocation are not implemented. Original stocking dates/counts are never rewritten.
