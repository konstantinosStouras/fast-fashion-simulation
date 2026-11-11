# Functionality and stress-test report

Tested on 10 November 2026 against the local `prototype` application. Changes are saved locally; production has not been deployed or load-tested. Synthetic accounts and the `demo-fashion-futures` Firebase emulators were used throughout.

## Bugs fixed

| Issue | Fix and evidence |
| --- | --- |
| A slow order subscription exposed default quantities before the saved decision arrived. A user could accidentally overwrite an existing order. | Student forms now wait for the saved-order snapshot; Firebase listeners ignore unconfirmed cache snapshots. Delayed-subscription regression test passes. |
| Live updates discarded unsaved quantities and instructor team edits. | Preserve decision drafts within the same phase and saved-order revision. Preserve team size, assignments and names across roster updates; reset drafts on explicit preview restart. |
| Delayed asynchronous work could update the wrong view after navigation or sign-out. | View/auth revisions reject obsolete callbacks and requests; session subscriptions are cleaned up. A delayed-profile/sign-out regression passes. |
| Large classrooms repeatedly serialized identical market inputs and rebuilt huge team editors. | Calculate each leaderboard market once, batch roster refreshes, and paginate membership editing to 25 participants. A 500-person editor test verifies that changes on separate pages save together. |
| A student joining between the instructor's roster read and session start could be left without a team. | Team joins atomically increment a roster revision; assignment/start transactions conflict and retry. Firestore rules require the participant and revision to be written together. Emulator tests force this interleaving and verify that the incomplete classroom remains in the lobby. |
| Results could be exported before participant decisions finished loading. | Disable and guard CSV export until the roster and every order subscription are confirmed. |
| Negative financial results were exported as apostrophe-prefixed text. Leading whitespace could also bypass formula protection for user text. | Preserve numeric values; escape potentially executable text, embedded quotes and multiline names. |
| Two valid 60-character profile names exceeded the 80-character participant-name limit, breaking solo creation/join. | Bound the generated participant display name to 80 characters; retain the full private profile. |
| Legacy team records with an unassigned participant could produce missing-result errors or NaN profile totals. | Show the no-team state before comparison, and exclude unassigned results from personal totals. |
| The local test server served PNGs as plain text, accepted unsupported methods and exposed dotfiles other than Git. | Correct MIME types, explicit GET/HEAD handling, dotfile/dependency/path-traversal guards, and a `nosniff` response header. |

## Validation

| Suite | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 41 passing tests, including nested resilience checks. |
| `npm run test:backend:stress` | 22 passing Auth, Firestore rules, real backend and backend stress checks. |
| `npm run test:stress` | 3 passing stress tests. |
| Chromium browser | Team preview through practice and all three seasons, initial/response saves, four/eight styles, final scoring and leaderboard. No captured warning/error console entries. |
| Responsive browser checks | 320, 390, 768 and 1280 px widths: no document overflow or visible enabled buttons below 44 × 44 px on the tested preview screen. Native validation rejected quantity 201; zero and 200 worked. |

The broader DOM suites also cover registration, verification gates, profile edits, login/logout, admin entrance, solo play, instructor studio, student join, captain/teammate permissions, all phase transitions, preview isolation and early closure. Existing distribution tests exercise 20,000 seeds.

### Stress measurements

- **2,000 shared markets + 8,000 individual outcomes**, including 100-team cases, maximum allowed demand settings, zero stock, high variance and assortment expansion. The shared runs simulated **2,316,245 customers**. Customer, stock, profit, footprint and switching identities all held; runtime was approximately **2.6 seconds**.
- **500 participants / 100 teams:** 500 leaderboard refreshes fell from **10,248 ms** before the change to **196 ms** after it on this machine (about **52× faster**). This is a local CPU benchmark, not a production latency claim.
- **2,000 local HTTP requests / concurrency 50:** all returned their expected status, including deliberate 404 requests; median **53 ms**, p95 **86 ms**, maximum **172 ms**. HEAD, MIME and path-protection checks also passed.
- **Firestore emulator, 500 participants / 100 teams:** 100 simultaneous-workload joins, 100 captain submissions and 300 result reads at concurrency 20; all expected operations succeeded and a teammate submission was denied. The final run measured p95 **554 ms**. Emulator timings do not establish production Firebase capacity.

Local execution logs and the browser screenshot are in `test-results/` (ignored by Git). The system's `npm` shim was broken, so the same Node test commands and bundled Firebase CLI were invoked directly; no global npm settings were changed.

## Release requirements and limits

The frontend and `firestore.rules` changes must be deployed together. New team joins require the new roster-revision transaction; old open tabs must reload after release. Existing sessions without a roster revision begin at zero on their next new join. Tests confirm that rejoining does not increment the revision. No data migration or production writes were performed.

Release sequence: arrange a quiet classroom window, deploy the dedicated FFO Firestore rules, publish the updated frontend, then reload instructor/student tabs before admitting new team members. The entry modules and changed profile/UI/backend imports have new cache versions. The archived `admin-login-release` directory was not modified.

Actual Google OAuth consent, real verification mailboxes, Safari/iOS, Android hardware and production throughput are outside this run. Local demo login and Auth-emulator tests are not a claim that those external flows were tested end to end.

![Browser verification of final team results](test-results/browser-results.jpg)
