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

## Individual play and team competition

Solo play starts from the signed-in welcome page; the student reads the briefing before starting the 18-minute clock. Each new game receives a random seed and appears in profile history.

Choose **Individual play** for participants to manage their own market. In **Team competition**, registered students join with the session code. The instructor groups students (three per team by default, configurable from 1 to 20) and can adjust membership, captains and names. Starting the session locks team membership and opponents through practice and all three scored seasons. The captain submits each decision on behalf of the team.

Each pair competes for its own demand pool. The configured demand mean and standard deviation apply to each pair. Customers choose among the two collections and try an available alternative when their preferred style sells out. Prices stay fixed. When one team offers eight styles, its market grows by half the configured extra-consumption rate. When both teams expand, the full rate applies. A team without an opponent uses the individual demand, replenishment and scoring rules, with the captain continuing to save decisions for the team.

After initial ordering locks, each team can see its market outcomes. Paired teams compare cumulative profit, sales, customers won or lost to their opponent, leftovers and footprint after each scored season. An unpaired team sees its own results. Instructors can review all matchups and export one CSV row per team and scored season. Each member’s profile shows the shared team result. Practice is excluded from scores.

Team preview uses one simulated rival with disclosed fixed decisions, the same shared-market engine and no database writes. The 18-minute structure is unchanged. This is a transparent teaching prototype, not an anti-cheating exam engine.

Administrators have independent Firebase accounts and class ownership. The platform owner (`kstouras@gmail.com`) manages administrator access and can oversee all classes. The existing `instructors` collection holds class-administrator grants; these accounts manage only their own classes. `admin@admin.com` signs into a separate account whose recovery email is `kstouras+ffo-admin@gmail.com` (delivered to the owner’s Gmail). Its UID, password changes, profile and sessions are independent of the owner’s Google account.

To add an administrator, sign in as the owner, open Admin area → Administrators, and enter their own email. They register or use Google and verify their email. No invitation email is sent. When creating a classroom, administrators can accept a suggested city or type a custom session code using 3 to 12 letters or numbers. Active and past sessions retain their codes. A facilitator can share the code or copy a link such as https://www.stouras.com/fast-fashion-simulation/?sessionCode=PARIS. Students register/sign in, complete their profile, and join before the session starts. Removing administrator access preserves all class records.

`npm run test:admins` runs the real authentication, account isolation, class ownership, registration/join/play and security-rules tests against local emulators. `tools/separate-admin-account.cjs` documents the one-time account split; its default is a read-only plan and `--apply` performs the guarded migration. Password hashes are kept in memory, never logged or saved.
