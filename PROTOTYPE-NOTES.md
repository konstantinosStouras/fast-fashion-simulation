# Fashion Futures: working teaching prototype

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

1. Visit the published page; log in with Google or email/password. Existing UCD Blog accounts work. Email/password registration requires verification before joining or teaching.
2. The verified administrator `kstouras@gmail.com` sees **Instructor studio** and **Admin / Access**. Grant another instructor access using their sign-in email; no invitation email is sent.
3. Create a session, optionally adjust the described settings, then share its eight-character code. Defaults are sufficient for the first discussion.
4. Students log in and join before the session starts. One account controls one participant record; a team can use one device/account and a team name.
5. Start when everyone is ready. All phases advance automatically. The instructor sees enrolment, saved decisions, completed-season scores and CSV export. Closing a session stops new submissions.
6. Admins can set defaults for future sessions or revoke instructor access. Existing session settings cannot change. Instructors see only their own rosters; the administrator sees all.

Authentication is shared with the blog's Firebase project. Gameplay lives in the separate named Firestore database `fashion-futures`; blog collections and rules are not modified. Sign-in tokens are managed by Firebase; passwords are not stored by this application. Session membership and decisions resume after refresh; the shared clock does not reset. An accurate device clock is needed for the countdown display; server rules enforce actual deadlines.

## Student preview for teaching staff

Choose **Preview as student** beneath the new-session form to try its current settings without creating a class. The same option inside an existing session uses that session's locked settings and market seed. The private rehearsal begins with practice and uses the real student decision screens and scoring.

The preview clock waits for **Next phase** or **Skip round**; **Restart preview** clears rehearsal decisions and reuses the same market. Save each decision before advancing. **Exit preview** returns to the originating session or the studio. Preview state lives in memory only, disappears on exit/reload/sign-out, and never writes participant records, changes a live clock, overwrites a student's saved session, or enters exported class results. Only verified teaching staff receive the controls.

## Deliberately outside the initial prototype

Durability/replacement behaviour, alternative metric visibility treatments, competitive demand, multi-account teams, an email invitation service, and simulation-platform completion tracking. Separate model/configuration/backend modules make these future additions possible without changing the authentication or session-code system. This release does not claim to implement those additional experiments.

## Validation

- Model tests cover schedule boundaries, normal demand distribution over 20,000 seeds, fixed-market substitution, matched scenarios, accounting identities, forecast signals, cap constraints and exclusion of practice.
- DOM integration test walks through instructor creation, invalid-code rejection, student join, all decision phases, final scoring and logout using synthetic accounts.
- Firestore emulator tests exercise verified accounts, instructor/admin boundaries, private rosters, late submissions, immutable initial orders during replenishment, defaults, parameter validation and cross-class isolation.
- Production read-only check verifies email/password and Google providers, the authorised domain, and separation from the blog's default database rules.

Google OAuth and mailbox verification require an actual user's interactive sign-in. These must not be described as end-to-end tested merely because emulator and configuration checks pass.
