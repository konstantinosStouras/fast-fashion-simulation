# Session cards and themes — 11 November 2026

- Active cards: Open, Copy link, Export data, Test round, Close session, Delete.
- Past cards: Open, Export data, Test round, Delete.
- Both show session ID, status, participant count, play mode, round format, name and creation time. Participant counts and existing session statuses update while the studio is open.
- Test round uses the existing private rehearsal, without changing classroom records. The separate “Preview as student” label is removed.
- Direct card exports use the same saved-decision scoring and CSV download as the open session. Only completed scored seasons count.
- Close preserves results in Past sessions. Delete requires confirmation, closes the session to prevent new joins/writes, removes each participant's orders and history reference in a batch, then deletes the parent. Failed cleanup can be retried. Only the owning instructor or platform owner may delete a closed session.
- Theme toggle is available on the main app and administrator entrance. Initial theme follows the system; an explicit choice persists locally and syncs across tabs. Storage being unavailable does not break the toggle.

## Validation

47 application tests passed, including direct export, card actions, cancellation, private rehearsal and theme persistence. All 20 Firestore emulator rule tests passed, including deletion rejection for students, other instructors, unverified users and open sessions.

Chrome checked actual DOM, theme colors, active/past button sets and theme persistence on reload. Both themes had no horizontal overflow at an actual 320 CSS-pixel viewport. Screenshot capture timed out, so visual screenshot review could not be completed. Temporary viewport overrides were reset. Browser checks used only local synthetic data.

## Deployment

Release order: deploy `firestore.rules` to the existing `stouras-ffo` project before publishing the updated frontend, including the new `theme.js` and `theme.css`. The new Delete action requires those rules. Deployment verification must compare the published rules and frontend assets against this release.
