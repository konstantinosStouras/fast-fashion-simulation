# Fast Fashion Ops

An 18-minute executive teaching simulation about the quick-response paradox.

Live: https://www.stouras.com/fast-fashion-simulation/

## Run

Use Node 22 or newer. Run `npm ci`, then `node tools/serve.mjs` and open http://localhost:8791/.

Real mode uses Firebase Google/email authentication and the default Firestore database in the dedicated `stouras-ffo` project (Fast Fashion Ops). The blog project is unchanged; FFO accounts are separate. Students verify their account and complete their profile. They can then start a private solo game without a code, or use an instructor’s code to join a classroom. Public Firebase web identifiers are not administrator credentials.

For a synthetic local preview, open http://localhost:8791/?demo. The Google button signs in as a fake admin; email/password can sign in as a fake student. This mode exists only on localhost/127.0.0.1 and uses browser storage, never production data. Demo phase-advance buttons are absent from production.

## Test

- `npm test`: model and DOM integration tests.
- `npm run test:stress`: synthetic market/accounting stress tests, 500-participant/100-team leaderboard benchmark, and 2,000 local HTTP requests.
- `npm run test:backend:stress`: local Auth/Firestore checks plus a 500-participant classroom workload (100 joins, 100 captain writes and 300 result reads).
- `npm run test:rules`: Firestore emulator access tests; Java 21+ required on PATH.
- `npm run test:backend`: authentication verification-link and Firestore access tests, entirely local.
- `node tools/check-backend.cjs`: read-only production configuration checks using existing Firebase CLI authorization; no credentials are printed.

## Deploy

GitHub Pages publishes main at the existing URL. Deploy database rules separately with `npx firebase deploy --only firestore --project stouras-ffo`. The checked-in firebase.json and .firebaserc target **only the dedicated FFO project**. `npx firebase deploy --only auth --project stouras-ffo` configures Google/email providers. Authorized domains include www.stouras.com, stouras.com and localhost.

See PROTOTYPE-NOTES.md for assumptions, defaults, teaching workflow, limitations and verification scope. No private emails or real student records are included in this repository.

See [QA-REPORT.md](QA-REPORT.md) for the 10 November functionality audit, fixes, stress measurements and release requirements. The new team-join transaction and Firestore rules must ship together; existing tabs need to reload after release.

Admin entrance: https://www.stouras.com/fast-fashion-simulation/admin/ — Google or email/password, with password reset. Verified administrators and authorized instructors are redirected to the studio; the URL does not grant access.

## Solo and shared-market teams

Solo play starts from the signed-in welcome page; the student reads the briefing before starting the 18-minute clock. Each new game receives a random seed and appears in profile history.

For teams, choose Team competition when creating a session. Registered students join using its code; the instructor randomly groups joined participants (default three, configurable 1–20), edits membership/captains/names, then starts. Only a captain submits; teammates share the live decisions and results. Membership locks at start.

Teams compete for ONE normally distributed demand pool. The demand mean and SD are market-wide, not per team. Every style adds customer-choice weight; a stockout customer tries an available alternative and can switch teams. Prices stay fixed. All customers switch if any alternative is available (an explicit teaching assumption). Extra consumption is applied once to the shared market: rebound × fraction of teams offering eight styles. With rebound zero, variety can only redistribute demand.

Orders become readable to session members after initial ordering locks, so every client can calculate the same early sales, forecasts and outcomes. Live competitor orders stay hidden before that deadline; emails and participant lists remain teaching-staff-only. The leaderboard shows cumulative profit, sales, customers won/lost to rivals, leftovers and footprint after each scored period. Practice is unscored. CSV exports one row per team/period; each member’s profile shows their shared team result.

Team preview uses one simulated rival with disclosed fixed decisions, the same shared-market engine and no database writes. The 18-minute structure is unchanged. This is a transparent teaching prototype, not an anti-cheating exam engine.

Admin password sign-in accepts `admin@admin.com` as an input alias for `kstouras@gmail.com`. Firebase authenticates the original account, preserving its UID, profile, sessions and permissions. Password setup/reset for either address goes to the Gmail inbox. Google sign-in is unchanged; the alias cannot be used for registration or as an account email.
