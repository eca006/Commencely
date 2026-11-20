# Secure recovery: rollout and operations

## Policy

- Keep the existing authenticator requirement. Email alone never resets a password or disables a second factor.
- Users can download backup codes at setup, and explicitly acknowledge the recovery limits. Codes are not recoverable from the server; only hashes are stored there.
- `/account-security` requires a valid signed-in session. Replacing codes or starting email enrollment additionally requires the current password and a fresh authenticator or unused recovery code.
- Code replacement revokes older codes and sessions. Show the new codes only in that response/page and offer a download before leaving.
- A password + last-backup-code sign-in automatically supplies replacement codes. Code-only password reset cannot spend the final code and strand the user. Verified-email reset with the last backup code provides replacement codes.
- Email enrollment does not change the sign-in identifier. Phone-only users may add a recovery email through the same authenticated flow.
- No previously stored username/address is grandfathered into recovery. The new email remains inactive until its explicit confirmation.
- If both the authenticator and backup codes are lost, no automatic or manual override is offered. An open session by itself is insufficient. Do not add support promises or email-only bypasses.
- Browser-stored drafts remain device-local. Recovery preserves the account ID, but does not introduce cloud backups or move drafts between devices.
- Replacing a lost authenticator is a separate future feature, not part of this change. Users with a password and backup codes can sign in and replenish backup codes.

## Delivery configuration (disabled by default)

The application uses a small server-side Resend HTTP adapter; no browser credentials or new SDK are needed. No provider account has been provisioned, no sender has been configured, and no real email has been sent by this change.

Configure these values **in the deployment's server-side secrets/environment UI**, never in source, chat, client assets or committed files:

- `ACCOUNT_EMAIL_RECOVERY`: set to `enabled` only after the staging checks below.
- `ACCOUNT_PUBLIC_ORIGIN`: the exact canonical HTTPS origin of this deployment, with no path, credentials, query or fragment.
- `ACCOUNT_EMAIL_FROM`: a sender email address on a domain verified with the email provider.
- `RESEND_API_KEY`: a restricted sending credential managed as a deployment secret.

For local-only tests the origin may be HTTP on localhost/127.0.0.1. Production links must use the canonical HTTPS origin, never the incoming Host header.

Validate sender/domain ownership and required DNS authentication with the provider. Turn off click tracking for recovery messages. Send only transactional security messages; no marketing consent is implied.

With configuration absent, invalid, or explicitly disabled:

- Account/code recovery continues to function.
- Email enrollment/reset endpoints fail closed.
- The UI states that email recovery is unavailable rather than pretending to send.

The Worker uses its execution context to finish background reset-email delivery. The local Node process uses best-effort background delivery; do not terminate it immediately after a request. Public responses are generic and independent of provider delivery results. Operational delivery failures emit a fixed message without recipient, link, token, provider response or credential values. Set up delivery/failure monitoring before production activation.

## Deployment sequence

1. Review and approve the PR. Take the hosting platform's supported database backup before the schema change.
2. Apply `drizzle/0002_recovery.sql` to the deployment database through the existing Sites migration workflow. It adds nullable/defaulted fields and new tables; it does not trust existing usernames as recovery addresses.
3. Deploy the reviewed Worker build with email recovery disabled. Local Node applies pending migrations automatically.
4. Confirm normal sign-in, existing sessions, account-scoped drafts, code download/replacement and storage-blocked behavior in staging.
5. Configure a verified sender and server-side secrets in **staging**; enable the feature there.
6. Complete the real-inbox checks below with a disposable staging account.
7. Obtain production deployment/activation approval, then configure production secrets, enable recovery, monitor failures and repeat a controlled smoke test.

Do not claim that merging a GitHub PR publishes the Sites-hosted website. `DEPLOYMENT.json` describes the last published source and is intentionally not rewritten by an undeployed feature PR.

For an incident, disable `ACCOUNT_EMAIL_RECOVERY` to stop email enrollment/reset while retaining code-based recovery. Prefer a forward fix. Do not roll back to account code that ignores `security_version` after activating the feature without a reviewed session/challenge/token invalidation plan.

## Staging acceptance checks

- Enroll a recovery address using password + fresh factor. Opening the email link alone does not change the address; confirmation is an explicit POST. The fragment is removed from browser history and is never sent as a query parameter.
- Confirm the recipient actually receives the message. Validate inbox/spam handling, configured origin, sender authentication, link expiry and security notifications.
- Confirm that an existing sign-in email is not usable for recovery before enrollment, and phone-only accounts can enroll.
- Ask for reset links for unknown, unenrolled, and enrolled identifiers. Check equivalent public responses and account/IP/global throttling.
- Verify that reset without the second factor does not change the password. Verify TOTP and unused backup-code paths.
- Test expired, superseded, replayed and wrong-purpose links, wrong/replayed factors, exhausted attempts and overlapping requests.
- Check that password reset keeps the account ID and authenticator, invalidates old sessions/challenges/links, and leaves existing browser-scoped drafts associated with that account.
- Check last-backup-code handling and replacement downloads. Old backup codes must stop working after replacement.
- Test desktop/mobile forms, keyboard navigation, readable errors, network/provider failures, timeout ambiguity, and storage denial. Never log raw codes or recovery links.

Automated tests and a local captured-email browser run are necessary but **not proof of real inbox delivery or production rollout**.

## Implementation references

- Resend email API: https://resend.com/docs/api-reference/emails/send-email
- Reset/confirmation links expire after 15 minutes. Only token hashes are stored in the database. Mutating GET requests are not used.
- Tokens and sessions bind to the account security version. A committed security change invalidates stale sessions even if an older request later inserts one.
- Email-reset tokens permit at most five attempts. Existing account-level factor limits apply; additional database-backed limits cover source IP, identifier, enrollment and total reset-email requests.
- Password changes still require a subsequent two-factor sign-in. Notifications are best-effort and do not turn a successful reset into a retryable apparent failure.
