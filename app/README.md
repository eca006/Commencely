# Commencely basic starter

A local job-search prototype. Requires Node.js 22 or later; no packages need installing.

1. Copy `.env.example` to `.env` in this folder.
2. Fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` locally. Do not share this file.
3. Open a terminal in this folder and run `npm start`.
4. Open http://localhost:3000 and search for jobs.

Credentials stay on the server. `.env` is ignored by Git. Do not put credentials in public JavaScript or commit them. The server binds to your computer only.

Run `npm test` to check response handling. To verify live integration, search marketing in Fayetteville, Arkansas, and compare three View job links with their returned company/location. Record the date and outcomes without credentials.

This version includes a three-question interest questionnaire, three explained career directions, browser-local saved answers with a clear control, and job searches for each direction. Each answer contributes one point to the corresponding direction; equal scores are ties. These are exploratory interest suggestions, not qualification assessments or a validated career test.

Job search supports a single page of up to ten results, loading/error/empty states, and listing links. Qualification matching, resumes, budget, and tracking are later steps. Salary fields are excluded. Confirm current Adzuna display requirements before publishing.

Career-direction searches review up to 50 listings and apply basic title relevance and clinical-role exclusions before displaying up to ten. Counts refer to this sample. Title filtering does not establish qualifications or entry-level suitability. Editing keyword/location fields returns to a general search. Run `node --env-file=.env check-live.mjs` for a credential-safe live search check.

Each job now includes snippet-based experience evidence. Explicit required/preferred cues are separated; alternatives, negation, mixed cues, and truncated clauses are marked unclear. Missing cues remain unknown. Entry-level wording alongside prior years of experience triggers a review flag, not a claim that experience is mandatory. These simple rules do not assess a person's qualifications and must be verified against the full posting.

Saved questionnaire answers collapse under Edit career answers. Repeat searches use a separate career selector without repeating the questionnaire. Changing location preserves the selected direction; changing keywords switches to a general search. Last submitted search fields are also saved in this browser, separately from career answers.
