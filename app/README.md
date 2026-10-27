# Commencely basic starter

A local job-search and resume prototype. Use Node.js 24 or later.

1. Copy `.env.example` to `.env` in this folder.
2. Fill in `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` locally. Do not share this file.
3. Open a terminal in this folder, run `npm ci` once to install the locked dependencies, then run `npm start`.
4. Open http://localhost:3000 and search for jobs.

Credentials stay on the server. `.env` is ignored by Git. Do not put credentials in public JavaScript or commit them. The server binds to your computer only.

Run `npm test` to check response handling. To verify live integration, search marketing in Fayetteville, Arkansas, and compare three View job links with their returned company/location. Record the date and outcomes without credentials.

This version includes a three-question interest questionnaire, three explained career directions, browser-local saved answers with a clear control, and job searches for each direction. Each answer contributes one point to the corresponding direction; equal scores are ties. These are exploratory interest suggestions, not qualification assessments or a validated career test.

Job search supports a single page of up to ten results, loading/error/empty states, and listing links. Personalized qualification matching, budget, and tracking are later steps. Salary fields are excluded. Confirm current Adzuna display requirements before publishing.

Career-direction searches review up to 50 listings and apply basic title relevance and clinical-role exclusions before displaying up to ten. Counts refer to this sample. Title filtering does not establish qualifications or entry-level suitability. Editing keywords returns to a general search; changing location preserves the direction. Run `node --env-file=.env check-live.mjs` for a credential-safe live search check.

Each job now includes snippet-based experience evidence. Explicit required/preferred cues are separated; alternatives, negation, mixed cues, and truncated clauses are marked unclear. Missing cues remain unknown. Entry-level wording alongside prior years of experience triggers a review flag, not a claim that experience is mandatory. These simple rules do not assess a person's qualifications and must be verified against the full posting.

Saved questionnaire answers collapse under Edit career answers. Repeat searches use a separate career selector without repeating the questionnaire. Changing location preserves the selected direction; changing keywords switches to a general search. Last submitted search fields are also saved in this browser, separately from career answers.

The selected VML/WPP Enterprise Solutions Greenhouse board is now a small full-description pilot. Its Northwest Arkansas jobs appear first, followed by Adzuna snippets. The pilot covers listed NWA cities regionally rather than the selected city's radius, and is identified in the results message. It is not a comprehensive job feed. It caches the board for ten minutes, labels retrieval time, applies direction/title and geography checks, and displays experience evidence before an expandable full description. Both sources are loaded independently so one source failure does not hide results from the other. General keyword searches use title terms on the employer pilot. API documentation: https://docs.greenhouse.io/job-board.html . Confirm provider/employer reuse conditions before broad publication.

## Resume builder

Open http://localhost:3000/resume . PDF, DOCX, and TXT files (up to 5 MB; PDFs up to 20 pages) are read entirely in the browser using locally served PDF.js and Mammoth libraries. No resume-upload endpoint exists. Only fixed library paths are served, not arbitrary dependency or filesystem paths.

Start with section headings or import existing text; edit optional name/contact fields and the resume body. No skills or work history are generated or inferred. The original layout is not preserved; users must review extraction order, especially columns. Scanned PDFs require OCR elsewhere; password-protected PDFs and legacy DOC are unsupported.

Drafts are saved to this browser only on explicit Save draft, with a clear-draft control. Files remain in memory until users choose to save/download. Downloads include plain text and standalone escaped HTML; Print / Save as PDF uses the browser print dialog and print-specific CSS. Empty heading-only drafts cannot be exported. Browser-local saves can be read by others using the same profile.

## Local support directory

`/support` links to three starting resources: the Fayetteville Arkansas Workforce Center, NWACC Career Services, and Arkansas 211 powered by Hark. Each entry includes its audience, contact action, and official source. Sources checked October 27, 2026; services and eligibility need periodic review. This is a manually curated directory, not live availability or automatic referrals.
