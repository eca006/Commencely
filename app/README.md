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

Open http://localhost:3000/resume . PDF, DOCX, and TXT files up to 5 MB are retained as original Blobs in browser IndexedDB, with their filename. The original is saved on import and restored on reopening. Its download link uses those original bytes, not regenerated HTML or extracted text. Originals are not uploaded to the server. If storage fails, a warning tells users it is available only for the current visit.

PDF previews render the supplied PDF pages locally using PDF.js (up to 20 pages), preserving page geometry, fonts, and images rather than rebuilding from text. Scanned PDFs can preview even when no editable text is available. Word files must be opened in Word via the original download to see exact layout; there is no claim of exact DOCX rendering in the browser. Password-protected or unsupported previews retain the original download.

The uploaded-resume flow shows only a saved confirmation, original filename, original preview, and replace/download/remove actions. Upload no longer extracts or rebuilds a text copy. The blank resume builder remains available when there is no original file. Save draft applies to that copy only; its formatting may differ and edits never change the original. Only supplied facts are used. Plain text, formatted HTML, and browser Print / Save as PDF are explicitly labeled copy exports. Replacing a file asks for confirmation and leaves any separate builder draft intact. Clearing asks to remove both the original and saved draft. Existing text-only saves require reimporting the original to recover original formatting.

Browser storage is local to the profile and can be cleared by browser settings. Fixed dependency routes do not expose arbitrary filesystem paths.

## Local support directory

`/support` includes the Fayetteville Arkansas Workforce Center, NWACC Career Services, Arkansas 211 powered by Hark, Dress for Success Northwest Arkansas, Goodwill Industries of Arkansas Career Services, and Walton Career Closet. Clothing and interview support have separate category links. New entries were checked October 28, 2026; earlier entries retain their October 27 check dates. Each entry includes its audience, contact action, and official source. Sources checked October 27, 2026; services and eligibility need periodic review. This is a manually curated directory, not live availability or automatic referrals.

## Jobs from saved answers

Submitting a complete questionnaire starts a search for the uniquely highest-scoring direction and scrolls to the search. Equal scores require choosing a direction rather than inventing a stronger fit. Returning with saved answers restores and loads the last submitted search, including manual keywords and location. Without a saved search, a unique leading direction starts the search. Manual searches and direction buttons remain available. New searches cancel older in-flight requests so stale responses cannot replace the current results; clearing career answers cancels the current request and clears its displayed results. This is interest-based search, not resume matching or qualification screening.

Resume preview and formatted HTML share a simple document layout with section headings, paragraph spacing, and bullet lists. Common headings are recognized from the supplied text; the source editor and plain-text download are unchanged. Wrapped lines are joined for display. Check the preview when importing unusual formats.

## Separate resume editor

The original upload view at `/resume` links to `/resume/edit`. The editor reads the retained original locally and creates an editable text version; the source file is unchanged. Drafts are stored separately under a SHA-256 digest of the source, so replacing the original does not silently reuse an unrelated edited draft. Blank resumes start at `/resume/edit?new=1`. Scanned or unreadable PDFs offer a paste-text editor; this is not an exact-layout PDF/Word editor. Save and edited downloads live on the editor page; Back returns to the original upload view.

October 28 directory expansion: added Samaritan Care clothing vouchers and resource navigation, Open Avenues disability employment support, NWACC Adult Education, Ozark Literacy Council, and ORT On-Demand. The directory now has eleven entries, with clothing, employment, college guidance, training/English, transportation, and community categories. These are contact/referral listings, not guaranteed availability. New entries cite provider sources and show eligibility, cost uncertainty where applicable, and the check date.

## Guided first-resume builder

`/resume/build` walks users through five steps: contact details, education/training, paid or unpaid experience, projects/skills, and review. Repeatable education, experience and project entries have plain-language prompts. All sections except name may be skipped; empty sections are omitted. The builder arranges only supplied facts and does not invent duties, results, metrics, or qualifications. Progress is saved only by the Save progress button under a separate browser-local key. Review supports formatted HTML, browser print/PDF, and an explicit handoff to `/resume/edit?builder=1`. A prior full-text builder copy requires confirmation before replacement. Original uploaded files and their edited copies are separate.
