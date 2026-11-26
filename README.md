# Resume Intelligence

Multi-profile resume and job-tracking app that runs entirely in the browser and deploys free on GitHub Pages. Data is stored in IndexedDB; there is no server.

## Deploy free on GitHub Pages
1. Create a GitHub repository and push this project to the `main` branch.
2. In the repository, open Settings > Pages and set Source to **GitHub Actions**.
3. Push again (or run the workflow manually). Your site appears at `https://<your-username>.github.io/<repo-name>/`.

## Run locally
`npm install && npm run dev` (tests: `npm test`)

## Milestone 1 (this version)
- Separate profiles (Profile 1, Profile 2, ...), each with its own master profile and jobs
- Master profile: personal info, skills, projects, experience, education, certifications
- Paste a whole job webpage: noise and duplicates removed, details extracted, editable before saving
- Transparent match report: matched, partial and missing skills, relevant projects, duplicate-job warning
- Saved jobs per profile, JSON backup and restore

## Added in Milestone 2
Generate a resume from the master profile for a job (profile items only, ordered by relevance), download as DOCX (A4, Calibri) or PDF (browser print dialog).

## Added in Milestone 3
Dark mode toggle, skill packs and bulk skill entry, one-tap add of missing skills you really have, 3 templates, in-app text editor, application tracker with status, date and notes.

## Added in Milestone 4
"Find jobs" tab: editable Google searches for direct career-site and ATS postings (Workday, Greenhouse, Lever and more) with job boards excluded.

## Added in Milestone 5
Centered header with clickable LinkedIn, GitHub and email links; aligned education, experience and project rows (dates and scores right-aligned); custom roles and skill packs.

## Added in Milestone 6
Resume layout modelled on a real fresher resume: bold titles and scores, two-column skills block, bullet points for projects and internships, automatic fit to one full A4 page (PDF). Skills from your profile that appear in the job text now count as job keywords.

## Added in Milestone 7
Career level (Fresher or Experienced) per profile. Experienced resumes lead with summary, technical skills and professional experience (company, city, dates, responsibilities, achievements, environment), then education and certifications; projects are optional. 1 page or up to 2 pages.

## Not built yet
AI rewriting of summary and bullets, templates, editor, ATS analyzer, application tracker, cover letters, interview prep, skill-gap roadmap, resume import, GitHub repo import.
Job extraction in this version is rule-based (no AI key needed). AI features will use your own API key stored in your browser.
