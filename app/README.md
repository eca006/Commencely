# Commencely

Career discovery and job search for Northwest Arkansas business graduates.

Live website: https://commencely.eca006.chatgpt.site
Repository: https://github.com/eca006/Commencely

The `app/` directory in the GitHub repository contains the current Site source. Previous repository snapshots omitted the live account and hosting code. Hosting uses the source repository managed by Sites. The GitHub deployment record identifies the exact Sites source commit copied into this repository.

## Run locally

Use Node.js 24 or later. From this directory:

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and add your own job-source credentials.
3. Run `npm start` and open http://localhost:3000.
4. Run `npm test` for the automated checks.

Never commit `.env`, account databases, uploads, or credentials. Local account data stays in the ignored `.account-data` directory.

## Behavior

- Jobs cover the ten Walton business majors and related functions. Search checks Adzuna and supported direct employer feeds, with pagination and deduplication. Provider limits and partial descriptions mean results are not an exhaustive inventory of every vacancy.
- Experience filters keep the existing early-career levels. A zero-experience match requires explicit zero-inclusive wording. Higher mandatory requirements take precedence over lower specialist requirements.
- Guests can use career, budget, and résumé tools. Drafts survive refresh and navigation in the same tab. A fresh tab starts a separate visit. Guests cannot save jobs.
- Accounts require an authenticator second factor. Sessions expire after seven days. Backup codes are one-use and can also reset a forgotten password. Resetting a password revokes active sessions. No email delivery service or support inbox is configured.
- Account drafts are stored on the current device under an account-specific key. Original résumé files use IndexedDB. They are not a shared public résumé collection.
- Résumé tools accept text, PDF, and DOCX files up to 5 MB, preserve originals, and offer editable layouts and PDF/Word/text exports.

## Hosting and checks

### Entry-level NWA job coverage

The public employer search also discovers current listings from TQL, First Security Bank, First Western Bank, Generations Bank, Bank OZK, and the Northwest Arkansas job board (Getro). No additional account or email address is needed for these sources. Getro descriptions are republished copies, explicitly attributed with a link to that copy; application links still lead to the employer.

Jobs must name a Northwest Arkansas city or county and Arkansas. Out-of-state jobs, expired structured postings, internal-only bank jobs, and TQL positions requiring relocation are excluded. Existing business-major and career-direction filters still apply. Frontline business roles with an unspecified minimum can appear as potential graduate matches, but never receive a confirmed zero-year label merely because they offer training or omit years.

Zero-year matches appear first. Required/listed minimums of up to three years remain eligible, including ranges such as 3–5. Explicitly optional experience is distinguished from required experience, months are converted to fractions of a year, and company history, awards, or future training are not applicant minimums.

Sources are cached for ten minutes. Regional searches cover six business job families and retrieve at most 24 full descriptions per refresh, prioritizing junior titles and mixing job families. The regional source has short timeouts and reports partial results when a page fails or a search is capped; this is not an exhaustive vacancy count. Employer rate limits and availability can change the results.

`.openai/hosting.json` preserves the existing Site identity and database binding. `node sites/build.mjs` creates the Worker output. Use the Sites source workflow to test, commit, package and publish this output.

Tests cover experience parsing, job normalization and relevance, résumé parsing and export, guest retention and account isolation, two-factor setup, one-use backup codes, and password recovery. Browser verification covers guest upload-to-editor handoff and refresh retention. Real-device and screen-reader testing remain separate checks.
