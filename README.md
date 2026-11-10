# Fashion Futures

An 18-minute executive teaching simulation about the quick-response paradox.

Live: https://www.stouras.com/fast-fashion-simulation/

## Run

Use Node 22 or newer. Run `npm ci`, then `node tools/serve.mjs` and open http://localhost:8791/.

Real mode uses Firebase Google/email authentication and the isolated `fashion-futures` Firestore database in the existing `stouras-ucd-blog` project. No student gameplay is shown before verified sign-in and session-code membership. Public Firebase web identifiers are not administrator credentials.

For a synthetic local preview, open http://localhost:8791/?demo. The Google button signs in as a fake admin; email/password can sign in as a fake student. This mode exists only on localhost/127.0.0.1 and uses browser storage, never production data. Demo phase-advance buttons are absent from production.

## Test

- `npm test`: model and DOM integration tests.
- `npm run test:rules`: Firestore emulator access tests; Java 21+ required on PATH.
- `node tools/check-backend.cjs`: read-only production configuration checks using existing Firebase CLI authorization; no credentials are printed.

## Deploy

GitHub Pages publishes main at the existing URL. Deploy database rules separately with `npx firebase deploy --only firestore --project stouras-ucd-blog`. The checked-in firebase.json targets **only the named fashion-futures database**. Never substitute the blog's default database configuration.

See PROTOTYPE-NOTES.md for assumptions, defaults, teaching workflow, limitations and verification scope. No private emails or real student records are included in this repository.
