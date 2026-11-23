# Fast Fashion Ops

A self-paced executive teaching simulation about the quick-response paradox.

Live: https://www.stouras.com/fast-fashion-simulation/

## Run

Use Node 22 or newer. Run `npm ci`, then `node tools/serve.mjs` and open http://localhost:8791/.

Real mode uses Firebase Google/email authentication and the default Firestore database in the dedicated `stouras-ffo` project (Fast Fashion Ops). The blog project is unchanged; FFO accounts are separate. Students verify their account and complete their profile. They can then start a private solo game without a code, or use an instructor’s code to join a classroom. Public Firebase web identifiers are not administrator credentials.

For a synthetic local preview, open http://localhost:8791/?demo. The Google button signs in as a fake admin; email/password can sign in as a fake student. This mode exists only on localhost/127.0.0.1 and uses browser storage, never production data. Demo phase-advance buttons are absent from production.

## Test

- `npm test`: model and DOM integration tests.
- `npm ci --prefix functions` followed by `npm run test:ai` runs the instructor directory and opponent-service tests against local Auth and Firestore emulators with synthetic provider responses.
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

Solo play starts from the signed-in welcome page; the student reads the briefing before starting the game and advancing each phase manually. Each new game receives a random seed and appears in profile history.

**Users & Teams** lists each registered user and the session codes of the classrooms they joined that went on to start. Search by name, email or student ID. Open a person’s entry to see waiting assignments, participation status, team and opponent in each phase. Instructors see participation within the classrooms they manage. The platform owner can review participation across classrooms.

Choose a numbered team beside each student and select **Save team assignments**. **Default teams · new classrooms** saves the instructor’s roster even before a classroom exists. New team classrooms copy that roster at creation. Select a waiting classroom to edit its teams separately. Students join with the classroom code, and each joined participant needs an assignment before play starts.

Below the directory, select a session code to see each team's members and its opponents for the practice and main phases. Human opponents appear once the session starts and the draw is complete. In an AI-enabled phase, each team faces its own opponent using the classroom’s selected model.

The platform owner can delete one registered account or all eligible accounts. Bulk deletion covers the full directory, including accounts outside the current search. A confirmation identifies the account or the total before deletion. The owner’s two administrator sign-ins are protected. Deleting an account removes its login and profile. Existing opponents and teammates keep their shared results.

At the start of a team classroom, the simulation shuffles the teams uniformly and pairs them without replacement. An odd team receives a randomly drawn bye and plays its own market in human-opponent phases. The draw stays fixed throughout the classroom. Captains submit decisions for their teams.

Each pair competes for its own demand pool. The configured demand mean and standard deviation apply to each pair. Customers choose among the two collections and try an available alternative when their preferred style sells out. Prices stay fixed. When one team offers eight styles, its market grows by half the configured extra-consumption rate. When both teams expand, the full rate applies. A team without an opponent uses the individual demand, replenishment and scoring rules, with the captain continuing to save decisions for the team.

After initial ordering locks, each team can see its market outcomes. Paired teams compare cumulative profit, sales, customers won or lost to their opponent, leftovers and footprint after each scored season. An unpaired team sees its own results. Instructors can review all matchups and export one CSV row per team and scored season. Each member’s profile shows the shared team result. Practice is excluded from scores.

Team preview uses one simulated rival with disclosed fixed decisions, the same shared-market engine and no database writes. Instructors advance classroom phases when their students are ready. This is a transparent teaching prototype, not an anti-cheating exam engine.

## AI opponents

In **AI settings**, an instructor can connect OpenAI, Anthropic and Google API keys and choose a text model available to their account. **Admin** lets the instructor enable AI separately for practice and the main phase at creation or in their waiting classroom. The main phase includes all three scored seasons. Private solo games use the existing individual market.

Starting an AI classroom requests one independent strategy from the selected model per team or individual participant per enabled phase. The model chooses opening stock, replenishment caps and, in the final season, collection size to maximize expected profit using the classroom's costs and demand distribution. Only simulation parameters go to the provider. Ready strategies persist through preparation retries and play starts when all opponents are ready. Each AI matchup shares one demand draw. Extra styles redistribute that demand and customers can switch firms after a stockout. Reports use the saved opponent decisions, and practice stays outside the scored totals. The local demo and private rehearsal use simulated decisions without provider charges.

### Enabling the live service

Use the dedicated Firebase project `stouras-ffo` with billing enabled. The application uses second-generation callable Functions in `us-central1`. The Functions service account needs access to Firestore and permission to list Firebase Authentication users.

On first setup, create the Secret Manager secret used to encrypt instructor keys. Preserve its value for subsequent releases so the service can decrypt previously saved keys.

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))" | npx firebase functions:secrets:set FFO_AI_KEY_ENCRYPTION --data-file - --project stouras-ffo
npm ci --prefix functions
npx firebase deploy --only functions,firestore:rules --project stouras-ffo
```

Publish the web files with the matching backend version, including the shared browser modules from the `functions` directory. A real instructor key is needed to run an AI classroom. Credentials stay encrypted on the server and the browser receives only connection status and the available models.

Administrators have independent Firebase accounts and class ownership. The platform owner (`kstouras@gmail.com`) manages administrator access and can oversee all classes. The existing `instructors` collection holds class-administrator grants; these accounts manage only their own classes. `admin@admin.com` signs into a separate account whose recovery email is `kstouras+ffo-admin@gmail.com` (delivered to the owner’s Gmail). Its UID, password changes, profile and sessions are independent of the owner’s Google account.

To add an administrator, sign in as the owner, open Admin area → Administrators, and enter their own email. They register or use Google and verify their email. No invitation email is sent. When creating a classroom, administrators can accept a suggested city or type a custom session code using 3 to 12 letters or numbers. Active and past sessions retain their codes. A facilitator can share the code or copy a link such as https://www.stouras.com/fast-fashion-simulation/?sessionCode=PARIS. Students register/sign in, complete their profile, and join before the session starts. Removing administrator access preserves all class records.

`npm run test:admins` runs the real authentication, account isolation, class ownership, registration/join/play and security-rules tests against local emulators. `tools/separate-admin-account.cjs` documents the one-time account split; its default is a read-only plan and `--apply` performs the guarded migration. Password hashes are kept in memory, never logged or saved.
