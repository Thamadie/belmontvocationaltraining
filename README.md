# Belmont Vocational Training

An animated website for Ausbildung (vocational training) in Germany, in the colours of the German flag, built for Belmont Migration Lawyers (Pvt) Ltd. Candidates create an account, build a Europass-style profile, upload their documents and apply for programmes. Staff manage everything from a separate admin panel.

Content (requirements, fees, blocked account, working rules, intakes, nursing degree, pathway to PR) comes from the *Vocational Training Requirements* leaflet.

## Features

**Public website**
- Homepage with the Reichstag (German parliament) hero photo: slow zoom, light sweep, flag stripe, rotating field names, count-up numbers, scroll reveals, a ticker, an animated pathway timeline and an FAQ
- Sections for the five fields, what Ausbildung is, requirements and fees (LKR), blocked account, working while studying, intakes, nursing degree, the 9-step pathway to permanent residence and why Belmont
- Programme listing with search and filters (city, field, programme type, intake) and a programme detail page

**German classes** (`/german-classes`)
- Short video lessons (1–5 minutes) grouped by level A1, A2, B1 and B2, with search and level tabs
- Lessons marked *Free* can be watched by anyone; all others need a (free) candidate account
- Video player with previous / next and an "up next" list; uploaded videos can be seeked and played on phones
- Signed-in candidates see their progress: a lesson counts as watched at 90% (YouTube lessons have a "Mark as watched" button)

**Candidate accounts** (`/login`, `/account`)
- Sign up / sign in (passwords hashed with scrypt, lockout after repeated failures)
- Progress tracker that staff update (Registered → German course → B1 passed → Applying → Offer → Blocked account → Visa → In Germany)
- Europass-style profile: personal details, education and work experience with years, language and digital skills, goals
- Document uploads (Europass CV, passport, photo, certificates, language certificates, other) with drag & drop; PDF, Word, JPG or PNG, max 8 MB
- One-click applications using the profile; application status tracking and withdrawal

**Admin panel** (`/admin`, separate login)
- Dashboard: active programmes and places, applications, candidates, payments, a 14-day chart of applications and sign-ups, the candidate journey and application pipeline
- Programmes: publish, edit, duplicate, delete, change status (active / draft / closed), feature on the homepage
- Applications: filter by programme and status, change status, notes, view each candidate's documents. **Export CSV** and **Download all (ZIP)** (CSV plus every applicant's documents, one folder each)
- Candidates: search and filter by stage and payment; set stage, payment status (not paid / initial payment / fully paid) and account status (active / suspended); view and edit the full profile; view, download or delete documents; download a candidate's profile and documents as ZIP; issue a temporary password; delete the account; export all candidates as CSV

- German classes: upload an MP4/WebM video (up to 300 MB) or paste a YouTube link; the length and a cover image are taken from the video automatically (or choose your own cover). Set level, topic, position, free/members-only and published/draft; reorder with the arrows; preview, edit and delete. Shows how many candidates watched each lesson.

### Video storage

Uploaded videos are stored in MongoDB (GridFS). The free Atlas M0 tier holds **512 MB in total**, which is only about 10–30 short lessons, so either:
- upgrade the Atlas cluster when you add many videos, or
- upload lessons to YouTube as **Unlisted** and paste the link in the admin panel (no database space used).

Note that a YouTube link marked "members only" is hidden on this website, but anyone who has the YouTube link itself can still watch it.

## Running it

You need Node.js 20.12 or newer and a MongoDB database (MongoDB Atlas works, the free M0 tier is enough). You can use the same Atlas cluster as Jobs in Germany; this app uses its own database (`belmontvocational`).

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and ADMIN_PASSWORD
npm start
```

Open http://localhost:3000. The admin panel is at http://localhost:3000/admin. On first start the app creates the database, its indexes and 10 sample programmes (edit or delete them in the admin panel).

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | *(required)* | MongoDB connection string |
| `MONGODB_DB` | `belmontvocational` | Database name |
| `ADMIN_USERNAME` | `admin` | Admin login name |
| `ADMIN_PASSWORD` | `admin123` | Admin password. **Change it before going live.** The panel shows a warning while the default is in use. |
| `PORT` | `3000` | HTTP port |
| `DNS_SERVERS` | *(system DNS)* | DNS servers for the Atlas lookup, e.g. `8.8.8.8,1.1.1.1` (fixes `querySrv ECONNREFUSED`) |
| `TRUST_PROXY` | *(off)* | Set to `1` behind a hosting proxy (Render, Railway, Heroku, Nginx) |

Setting up Atlas and fixing connection errors work exactly as in the Jobs in Germany project: create a cluster and a database user, allow your server's IP under Network Access, and paste the `mongodb+srv://…` string into `MONGODB_URI`. The app prints a hint when it can't connect.

## Notes

- Candidates who forget their password: open the candidate in the admin panel and click **Reset password**. Give them the temporary password; they can change it under *Password* in their account.
- Uploaded documents contain personal data (passports, certificates). Serve the site over HTTPS, choose an EU or nearby region for the database, and make sure your privacy policy covers storing them.
- This is a Node.js app, not a static site. Host it somewhere that runs Node (Render, Railway, Fly.io, a VPS).
- Hero photo: *Reichstagsgebäude bei Sonnenuntergang* by Ansgar Koreng, CC BY-SA 3.0 DE. Second photo: *Reichstagsgebäude (Westfassade)* by Jörg Braukmann, CC BY-SA 4.0. Both from Wikimedia Commons; the credit is in the site footer.

## Project structure

```
server.js            Express server and REST API (public, candidate and admin)
lib/store.js         MongoDB data layer (collections + GridFS for documents)
lib/auth.js          Admin login, candidate accounts, sessions and lockout
lib/seed.js          Sample programmes
public/              Website (HTML/CSS/JS, no build step)
  index.html         Homepage
  programmes.html    Programme listing
  programme.html     Programme detail and application
  login.html         Sign in / create account
  account.html       Candidate area (profile, documents, applications)
  admin/             Admin panel
  css/               style.css (base) and belmont.css (pages)
  js/                Page scripts; common.js holds the shared header, footer and helpers
  assets/            Photos and favicon
```
