# Commencely basic starter

A local job-search prototype. Requires Node.js 22 or later; no packages need installing.

1. Copy `.env.example` to `.env` in this folder.
2. Fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` locally. Do not share this file.
3. Open a terminal in this folder and run `npm start`.
4. Open http://localhost:3000 and search for jobs.

Credentials stay on the server. `.env` is ignored by Git. Do not put credentials in public JavaScript or commit them. The server binds to your computer only.

Run `npm test` to check response handling. To verify live integration, search marketing in Fayetteville, Arkansas, and compare three View job links with their returned company/location. Record the date and outcomes without credentials.

This version supports a single page of up to ten results, loading/error/empty states, and listing links. Questionnaire, profiles, matching, resumes, budget, and tracking are later steps. Salary fields are excluded. Confirm current Adzuna display requirements before publishing.
