# Pond Companion handoff — 2026-10-27

## Scope
Standalone Android-first fish/prawn pond app, separate from `/Users/shanawaz/ib-fresh-fish-tools`. Work only in `/Users/shanawaz/pond-companion`. English/Telugu/Hindi. User values concise updates and low token use. No subagents unless asked.

## Current work
Supabase email/password sign-in, farm selection/creation, transactional normalized data saves, private file upload/download, admin/worker access, assigned ponds, local-data import/backup and conflict handling implemented. Admin-only: money, expenses/receipts, stocking, harvest, pond setup, staff/export. Workers: assigned pond operational records, no money. No approval queue/offline cloud queue/realtime sync yet. `.env.local` has the new project's URL and publishable key; never print values.

## Live backend status
User ran `supabase/setup.sql` on 2026-10-27. Live probes confirm organizations is available (HTTP 200, no anonymous rows); farm_read and farm_save are deployed and reject anonymous calls; farm_read explicitly returns "Access denied". Auth endpoint is available with email enabled. Preview on localhost:8092 returns HTTP 200. Real signed-in account, save, cross-device reload and file upload/download smoke tests still need the user to create/sign in to their account. Do not create accounts or send emails on their behalf without authorization. No admin management credential is available; never print environment values.

## Files to read selectively
- `src/cloud.ts`: active farm context, cloud read/save, attachment uploads, signed URLs. Cloud data is in memory; local store stays untouched.
- `src/cloudMapping.ts`: domain↔database mappings and append-only deltas.
- `src/supabase.ts`: client, SecureStore sessions, language preference.
- `src/CloudGate.tsx`: authentication/farm onboarding and cloud translations.
- `App.tsx`: existing screen UI, role gating, settings worker assignment and local import.
- `supabase/migrations/202610250006_cloud_access.sql`: RPC, RLS, permissions, assignments, serializable-by-farm revision lock.
- `src/operations.ts`: FIFO batches, counts, expenses; `src/domain.ts`: validation/core types.

## Verification
Use Node 24 installed in `node_modules/node/bin/node`.
`npm run typecheck`; `npm run lint`; `npm test` (domain/PostgreSQL tests).
`npm run test:cloud-ui` (mocked cloud admin/worker screens, port 8092).
`node_modules/node/bin/node node_modules/@playwright/test/cli.js test` (local production-export regressions, port 8093).
`npm run export:android` (JS/Hermes export, NOT an APK).
Setup SQL generator: `node scripts/build-supabase-setup.mjs`.
No native Android device/emulator test yet. No trading app changes. All project work remains uncommitted; do not revert unrelated existing changes.

Latest verification: 17 domain/SQL tests, 6 local UI flows, 2 mocked cloud UI flows, lint/typecheck and Android export pass. Live schema is now deployed; authenticated smoke tests remain. Expo development dotenv opt-out was insufficient; local test config uses production export instead.

Latest UI change: culture names are automatic pond names (no date suffix). `src/DateField.tsx` / `.web.tsx` replace every editable date with native/browser pickers, default local today; past dates allowed within culture bounds. Six UI flows, lint/typecheck and Android export pass. Added Expo-compatible `@react-native-community/datetimepicker`; native dev builds need rebuilding.

### Lab reminders and cloud status — 2026-10-27
- No recorded lab sample now shows no lab report, rather than calculating overdue from culture start. Manual readings do not reset lab reminders; clarified in all three languages.
- Configured Supabase storage fails closed when farm context is missing; never falls back to local writes. CloudGate checks active context, and cloud UI replaces outdated local-only copy.
- Verified real signed-in farm after reload: pond interval 30, October 26 water readings and October 26/27 feed records loaded from cloud. Existing local records preserved.
- Typecheck, lint, 18 automated tests and 2 mocked cloud browser flows passed.

### Owner/worker onboarding and Team — 2026-10-27
- Separate sign-in/create-account modes. Signup explicitly chooses farm owner or worker (onboarding metadata only, never authority). Existing single-farm users auto-open; Settings → Choose your farm supports switching or joining another farm.
- Owners create farms; workers enter an invitation code. Removed UUID exchange from onboarding and Settings. All new copy supports English, Telugu and Hindi.
- Team is available from farm home and Settings. Admins create named invitations with selected ponds; see workers/assignments; edit ponds; confirm removal; cancel pending invites. Codes expire after 7 days and are single-use. Share codes manually; no SMS/email is sent. Existing workers without an invitation name show “Worker”.
- Migration REQUIRED on live Supabase: apply ONLY `supabase/migrations/202610270007_team_invites.sql` in the existing Pond Companion project. Do not rerun setup.sql on an existing project. No database admin credentials available in this session, so migration is prepared and locally verified, not deployed.
- Security checks: admin-only Team management; invitation consumption locks the invite; no self-promotion or replacement of existing roles; foreign-pond assignment rejected; expired/cancelled/consumed invites denied; worker removal revokes server read access.
- Validation: typecheck/lint; 19 unit/database tests; 3 mocked browser flows (owner signup, admin Team invite/cancel, worker join + assigned access); Android JS/Hermes export. Physical Android testing still outstanding.

### Daily entry Trash/Restore — 2026-10-28
- Admin cloud entry detail → Move to Trash → explicit confirmation. Settings → Trash → Restore. English/Telugu/Hindi. No live user records deleted during development.
- Server-managed entry_trash keeps source entries/photos/readings. farm_read excludes trashed records and their children; reports, stock and expense calculations refresh accordingly. Workers cannot manage/read Trash or open trashed file links. Admin file access remains for recovery.
- All mutations lock the organization, check expected revision, audit actor/action, validate live chronological stock, and increment revision. farm_save uses the same stock validator excluding trashed removals. Invalid restores roll back.
- Apply ONLY supabase/migrations/202610280008_entry_trash.sql to the existing Pond Companion project. Not yet deployed. Do not rerun full setup.sql.
- Scope: daily entries only (feed, water, treatment, observation, growth, harvest, legacy entry expenses). Separate farm expenses, stocking batches, ponds and farms are not deletable yet; archiving remains a separate step. No permanent purge.
- Verified typecheck/lint, 19 unit/database tests (expanded cloud coverage includes trash/restore permissions, revision, attachment visibility, and stock-overdraw rollback), and 3 browser flows including admin trash/restore and worker restrictions. Reminder availability on web must not turn a successful database mutation into an error.
