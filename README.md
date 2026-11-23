# Fast Fashion Ops

A self-paced executive teaching simulation about the quick-response paradox.

Live: https://www.stouras.com/fast-fashion-simulation/

## Run

Use Node 22 or newer. Run `npm ci`, then `node tools/serve.mjs` and open http://localhost:8791/.

Real mode uses Firebase Google/email authentication and the default Firestore database in the dedicated `stouras-ffo` project (Fast Fashion Ops). The blog project is unchanged; FFO accounts are separate. Students verify their account and complete their profile. They can then start a private solo game without a code, or use an instructor’s code to join a classroom. Public Firebase web identifiers are not administrator credentials.

For a synthetic local preview, open http://localhost:8791/?demo. The Google button signs in as a fake admin. Email/password can sign in as a fake student. This mode runs on localhost/127.0.0.1 and uses browser storage.

## Test

- `npm test`: model and DOM integration tests.
- `npm ci --prefix functions` followed by `npm run test:ai` runs the instructor directory and opponent-service tests against local Auth and Firestore emulators with synthetic provider responses.
- `npm run test:stress`: synthetic market/accounting stress tests, 500-participant/100-team leaderboard benchmark, and 2,000 local HTTP requests.
- `npm run test:backend:stress`: local Auth/Firestore checks plus a 500-participant classroom workload (100 joins, 100 captain writes and 300 result reads).
- `npm run test:rules`: Firestore emulator access tests; Java 21+ required on PATH.
- `npm run test:backend`: authentication verification-link and Firestore access tests, entirely local.
- `node tools/check-backend.cjs`: read-only production configuration checks using existing Firebase CLI authorization; no credentials are printed.

## Deploy

Deploy the updated Functions (including `joinTeamClassroom`) and Firestore rules to `stouras-ffo` before publishing the app. To switch from timed play, run `node tools/migrate-manual-stages.mjs --apply` immediately after the rules deployment. It saves each running classroom’s stage at cutover and can be rerun safely. If the existing rules already specify an earlier freeze, run the migration before replacing those rules so it preserves that stage. If those rules were already replaced, supply their verified timestamp with `--previous-cutover=<ISO timestamp>`. Omit `--apply` to preview the affected classroom count.

GitHub Pages publishes main at the existing URL. Deploy database rules separately with `npx firebase deploy --only firestore --project stouras-ffo`. The checked-in firebase.json and .firebaserc target **only the dedicated FFO project**. `npx firebase deploy --only auth --project stouras-ffo` configures Google/email providers. Authorized domains include www.stouras.com, stouras.com and localhost.

See PROTOTYPE-NOTES.md for assumptions, defaults, teaching workflow, limitations and verification scope. No private emails or real student records are included in this repository.

See [QA-REPORT.md](QA-REPORT.md) for the 10 November functionality audit, fixes, stress measurements and release requirements. The new team-join transaction and Firestore rules must ship together; existing tabs need to reload after release.

Admin entrance: https://www.stouras.com/fast-fashion-simulation/admin/ — Google or email/password, with password reset. Verified administrators and authorized instructors are redirected to the studio; the URL does not grant access.

## Individual play and team competition

In solo play, the student starts from the signed-in welcome page and advances each phase when ready. Each new game receives a random seed and appears in profile history. In classrooms, the instructor starts and advances the scored simulation for everyone. Advancing locks the preceding phase’s decisions.

**Users & Teams** lists each registered user and the session codes of the classrooms they joined that went on to start. Search by name, email or student ID. Open a person’s entry to see waiting assignments, participation status, team and opponent in each phase. Instructors see participation within the classrooms they manage. The platform owner can review participation across classrooms.

Choose **Students per team** when you create a team classroom. The default is three and the supported range is 1–20. Students who join with the classroom code are assigned to teams automatically. For example, seven students at the default size form groups of three, three and one. In the waiting classroom you can review the roster, reshuffle joined students or adjust membership, captains and team names. **Users & Teams** also lets you choose a numbered team for a registered student before they join.

Default team assignments can also be saved in **Users & Teams** before a classroom exists. A new team classroom copies these preferences at creation. Students without a preference join the next available group. Select a waiting classroom to edit only that classroom’s assignments.

The platform owner can delete one registered account or all eligible accounts. Bulk deletion covers the full directory, including accounts outside the current search. A confirmation identifies the account or the total before deletion. The owner’s two administrator sign-ins are protected. Deleting an account removes its login and profile. Existing opponents and teammates keep their shared results.

While the classroom is waiting, every joined student can practice at home against the built-in AI. Each student chooses opening stock and replenishment, sees both businesses’ results, and can start another round in a fresh market. Practice is private to the student’s tab and unscored. The built-in opponent runs locally without a provider key.

When the instructor starts the competition, the simulation shuffles the teams and pairs them without replacement. Captains submit decisions for their teams against the same opponent across all three scored seasons. With an odd number of teams, one randomly selected team receives a bye and plays its own market.

Each pair competes for its own demand pool. The configured demand mean and standard deviation apply to each pair. Customers choose among the two collections and try an available alternative when their preferred style sells out. Prices stay fixed. When one team offers eight styles, its market grows by half the configured extra-consumption rate. When both teams expand, the full rate applies. A team without an opponent uses the individual demand, replenishment and scoring rules, with the captain continuing to save decisions for the team.

After initial ordering locks, each team can see its market outcomes. Paired teams compare cumulative profit, sales, customers won or lost to their opponent, leftovers and footprint after each scored season. An unpaired team sees its own results. Instructors can review all matchups and export one CSV row per team and scored season. Each member’s profile shows the shared team result. Practice is excluded from scores.

The instructor’s private team preview includes the built-in AI practice and a simulated rival for the scored seasons. The instructor controls progression and preview decisions stay in the current tab.

## AI opponents

For **Individual play** classrooms, an instructor can connect OpenAI, Anthropic or Google in **AI settings** and choose a text model available to their account. The instructor can enable this optional opponent for practice, the three scored seasons, or both. Private solo games use the individual market.

Starting a provider-enabled individual classroom requests one independent strategy for each participant and enabled phase. The model chooses opening stock, replenishment caps and, in the final season, collection size using the classroom’s costs and demand distribution. Only simulation parameters go to the provider. Ready strategies persist through retries. The session starts once the opponents are ready and the instructor advances each phase. Each AI matchup shares one demand draw. Extra styles redistribute demand and customers can switch firms after a stockout. Reports use the saved opponent decisions. The local demo and private rehearsal use simulated decisions without provider charges.

### Enabling the live service

Use the dedicated Firebase project `stouras-ffo` with billing enabled. The application uses second-generation callable Functions in `us-central1`. The Functions service account needs access to Firestore and permission to list Firebase Authentication users.

On first setup, create the Secret Manager secret used to encrypt instructor keys. Preserve its value for subsequent releases so the service can decrypt previously saved keys.

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))" | npx firebase functions:secrets:set FFO_AI_KEY_ENCRYPTION --data-file - --project stouras-ffo
npm ci --prefix functions
npx firebase deploy --only functions,firestore:rules --project stouras-ffo
```

Publish the web files with the matching backend version, including the shared browser modules from the `functions` directory. An instructor key enables provider-backed opponents in individual classrooms. Credentials stay encrypted on the server and the browser receives only connection status and the available models.

Administrators have independent Firebase accounts and class ownership. The platform owner (`kstouras@gmail.com`) manages administrator access and can oversee all classes. The existing `instructors` collection holds class-administrator grants; these accounts manage only their own classes. `admin@admin.com` signs into a separate account whose recovery email is `kstouras+ffo-admin@gmail.com` (delivered to the owner’s Gmail). Its UID, password changes, profile and sessions are independent of the owner’s Google account.

To add an administrator, sign in as the owner, open Admin area → Administrators, and enter their own email. They register or use Google and verify their email. No invitation email is sent. When creating a classroom, administrators can accept a suggested city or type a custom session code using 3 to 12 letters or numbers. Active and past sessions retain their codes. A facilitator can share the code or copy a link such as https://www.stouras.com/fast-fashion-simulation/?sessionCode=PARIS. Students register/sign in, complete their profile, and join before the session starts. Removing administrator access preserves all class records.

`npm run test:admins` runs the real authentication, account isolation, class ownership, registration/join/play and security-rules tests against local emulators. `tools/separate-admin-account.cjs` documents the one-time account split; its default is a read-only plan and `--apply` performs the guarded migration. Password hashes are kept in memory, never logged or saved.
