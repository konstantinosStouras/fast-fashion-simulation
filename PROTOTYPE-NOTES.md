# Fast Fashion Ops: working teaching prototype

## The classroom experiment

Participants run a fashion house through a three-minute practice and three scored seasons: advance commitment (four minutes), quick response (four minutes), and assortment expansion (five minutes). A two-minute comparison completes the shared 18-minute session. Preparation/login happens before the instructor starts the clock. The session cannot be paused or extended; closing early locks further decisions and counts only completed seasons.

Initial quantities are one integer per style, from 0 to 200. The last season allows four or eight styles. Quick-response seasons provide an early-sales and remaining-demand forecast table halfway through, followed by one replenishment cap from 0 to 200. Replenishment per style = min(cap, max(0, forecast - remaining stock)). Early lost sales cannot be recovered. Missing decisions default to four styles, 80 initial units per style and cap zero.

## Default assumptions

- Aggregate market demand: normal draw with mean 480, SD 96; rounded and floored at zero. At high SD/low mean this clipping changes the realised mean and SD.
- Style shares: heterogeneous positive weights, normal around 1 with SD 0.4 and minimum 0.1, normalised to the aggregate total.
- Eight styles redistribute the base market, then add the configured consumption response (default 20%). They do not automatically double demand.
- Forecast relative error: normal, SD 20%, forecasts floored at zero. Half of demand arrives before the response decision.
- Price €40; initial unit cost €12; replenishment €16; development €150/style; salvage €5/unit.
- Footprint: 5 kg CO2e/produced unit plus 1 kg/leftover unit. No automatic emissions premium for speed.
- Identical seeded underlying demand across the three scored seasons supports comparison. Practice uses a separate draw. Participants should not treat the repeated demand as a forecasting exam.
- Profit is the business score. Leftovers and absolute footprint are separate outcomes; there is no arbitrary weighted sustainability score.

All assumptions are illustrative, not calibrated estimates. This is a discussion prototype, not a secure high-stakes examination: model coefficients and the seed are inspectable in the browser. Database rules prevent changing others' data, changing session conditions, submitting totals, or modifying decisions outside their phase. Results are recalculated from immutable/configuration-locked inputs rather than accepting uploaded scores.

## Access and teaching workflow

1. Visit the published page; log in with Google or email/password. FFO uses its own account system, separate from UCD Blog. Email/password registration requires verification before joining or teaching.
2. The verified administrator `kstouras@gmail.com` sees **Instructor studio** and **Admin / Access**. Grant another instructor access using their sign-in email; no invitation email is sent.
3. Create a session, optionally adjust the described settings, then share its eight-character code. Defaults are sufficient for the first discussion.
4. Students log in and join before the session starts. One account controls one participant record; a team can use one device/account and a team name.
5. Start when everyone is ready. All phases advance automatically. The instructor sees enrolment, saved decisions, completed-season scores and CSV export. Closing a session stops new submissions.
6. Admins can set defaults for future sessions or revoke instructor access. Existing session settings cannot change. Instructors see only their own rosters; the administrator sees all.

Authentication, private profiles and gameplay live in the dedicated Firebase project `stouras-ffo`, default Firestore database in `eur3`. The UCD Blog project is not modified. No existing classroom sessions were present in the old prototype at cutover. Sign-in tokens are managed by Firebase; passwords are not stored by this application. Session membership and decisions resume after refresh; the shared clock does not reset. An accurate device clock is needed for the countdown display; server rules enforce actual deadlines.

## Student preview for teaching staff

Choose **Preview as student** beneath the new-session form to try its current settings without creating a class. The same option inside an existing session uses that session's locked settings and market seed. The private rehearsal begins with practice and uses the real student decision screens and scoring.

The preview clock waits for **Next phase** or **Skip round**; **Restart preview** clears rehearsal decisions and reuses the same market. Save each decision before advancing. **Exit preview** returns to the originating session or the studio. Preview state lives in memory only, disappears on exit/reload/sign-out, and never writes participant records, changes a live clock, overwrites a student's saved session, or enters exported class results. Only verified teaching staff receive the controls.

## Deliberately outside the initial prototype

Durability/replacement behaviour, alternative metric visibility treatments, competitive demand, multi-account teams, an email invitation service, and simulation-platform completion tracking. Separate model/configuration/backend modules make these future additions possible without changing the authentication or session-code system. This release does not claim to implement those additional experiments.

## Validation

### Registration and profiles

Email registration asks only for first name, last name, university ID, email and password. Firebase sends the verification link; verification is required before class access. Google sign-in uses Google's verified identity, then asks for the missing profile details. My profile & stats supports name/ID edits, verified email changes, password-reset emails, and private session history. Email changes retain the Firebase UID and its decisions. No passwords are stored in Firestore.

History links are recorded when a student joins a class. Totals are recalculated from completed scored seasons and saved orders; practice and private previews never enter these totals. Sessions stopped early count only seasons completed before closure.

### Simulation portal handoff

The existing portal has a different Firebase project and uses anonymous identities, so it is not single sign-on. FFO accepts the portal's existing `simp:handoff:v1` local-storage format on the same origin, with `sim: 'ffo'` (also accepts the longer current and former names), version 1, and a timestamp no more than six hours old. Its profile email must match the signed-in, verified FFO account. Nothing is imported for a mismatching account, stale handoff or another simulation.

All current portal registration fields are preserved under the private `platformRegistration` map: name, email, studentId, age, gender, nationality, country, levelOfStudy, workExperience, occupation, industry, englishFluency, createdAt and updatedAt. Core profile edits merge rather than replacing that map. Portal permissions, approval flags, completion markers and passwords are never imported. This is self-reported profile data, not a trusted authentication claim.

Future portal integration should add a catalog entry with key `ffo` and path `/fast-fashion-simulation/`, retaining the same `www.stouras.com` origin. This release prepares the receiver; it does not add or activate the portal card, migrate its anonymous accounts or synchronize completion markers back to the portal.

### Latest functionality audit (10 November 2026)

The subsequent audit passes 41 model/DOM checks, 22 Firebase/backend checks and 3 stress tests. It covers 500-participant team editing, concurrent joins, delayed subscriptions, draft preservation and CSV export. See [QA-REPORT.md](QA-REPORT.md) for fixes, measurements, limits and the coordinated frontend/rules release requirement.

### Earlier interface coverage (10 November 2026)

32 automated checks pass: 18 model/DOM/helper tests plus 14 Firebase Auth/Firestore emulator checks. The real backend module is exercised against emulators for registration, profile persistence, verification-link redemption, login and password-reset link generation. No test email or fake account is sent to the live Firebase project.

In-app Chromium checks cover registration, the email-verification gate, profile editing, instructor preview and saved decisions at 320px phone width, plus 390px and 768px responsive checks. At 320px the tested screens have no page overflow and no visible button below 44px in either dimension. Dialogs scroll within the viewport, inputs use 16px text, tables scroll horizontally, and keyboard focus and reduced-motion styles are provided. The installed Windows Firefox could not be tested because computer-use URL policy support blocked that browser. Actual Safari/macOS/iOS and Android hardware have not been tested; this is not a claim of universal browser certification.

- Model tests cover schedule boundaries, normal demand distribution over 20,000 seeds, fixed-market substitution, matched scenarios, accounting identities, forecast signals, cap constraints and exclusion of practice.
- DOM integration test walks through instructor creation, invalid-code rejection, student join, all decision phases, final scoring and logout using synthetic accounts.
- Firestore emulator tests exercise verified accounts, instructor/admin boundaries, private rosters, late submissions, immutable initial orders during replenishment, defaults, parameter validation and cross-class isolation.
- Production read-only check verifies email/password and Google providers, the authorised domain, the FFO project and European database, and the deployed rules release.

Google OAuth and mailbox verification require an actual user's interactive sign-in. These must not be described as end-to-end tested merely because emulator and configuration checks pass.
