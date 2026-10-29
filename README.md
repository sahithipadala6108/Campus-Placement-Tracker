# Campus Placement Tracker

A beginner-friendly full-stack college project for discovering campus placement drives and managing student applications. The interface uses HTML, CSS and vanilla JavaScript; Express provides the REST API; Supabase PostgreSQL stores the data.

## Problem and objectives

Students often need to track company names, job roles, eligibility requirements, deadlines and application outcomes across different notices. This application brings current placement drives into one dashboard and gives the placement coordinator one place to manage drives and application status.

## Users and features

- **Students (public view):** browse and search placement drives; filter open drives; submit an application with name, college email, roll number and CGPA.
- **Placement coordinator (protected):** sign in with a locally configured password; create and edit drives; review applications; update status to Applied, Shortlisted, Interview, Selected or Rejected.
- Server-side validation, duplicate-application prevention, CGPA/deadline checks, rate limiting, security headers and PostgreSQL constraints.

This MVP does not provide student accounts, password reset, resume uploads, email notifications, or a public student-specific application history. Students should not submit sensitive information beyond the fields requested.

## Technology stack

- HTML5, CSS3 and vanilla JavaScript
- Node.js (20 or later), Express.js
- Supabase PostgreSQL and `@supabase/supabase-js`
- Git and GitHub

## Folder structure

```text
campus-placement-tracker/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## Prerequisites

Install [Node.js LTS](https://nodejs.org/), [Git](https://git-scm.com/downloads), [Visual Studio Code](https://code.visualstudio.com/) and create a free [Supabase](https://supabase.com/) account. You do not need a frontend framework or a paid API.

## Setup on Windows

1. Download or clone this folder and open it in VS Code. Open **Terminal → New Terminal** at the project root.
2. Verify tools:

   ```powershell
   node --version
   npm --version
   git --version
   ```

   Node should be version 20 or newer.

3. Create a Supabase project at https://supabase.com/dashboard. In **Project Settings → API** (the exact menu may change), copy the Project URL and the server-side service-role key. Never use that key in frontend code or share it publicly.
4. In Supabase, open **SQL Editor → New query**, paste the entire `database/schema.sql`, and click **Run**. In **Table Editor**, confirm that `placement_drives` and `applications` exist. The tables have RLS enabled and no public policies; only the Express backend accesses them.
5. In VS Code, copy `backend/.env.example` to a new file named `backend/.env`. Replace the example URL and service-role key with your own values. Do not commit `.env`.
6. Create a bcrypt password hash and a JWT secret. From the `backend` directory, first install packages (next step), then run the hash command shown below. Use a memorable but strong coordinator password.
7. Install backend packages from the project root:

   ```powershell
   cd backend
   npm install
   ```

8. Generate the password hash. Replace `YourStrongLocalPassword` with your chosen password and keep the output private:

   ```powershell
   node -e "console.log(require('bcryptjs').hashSync('YourStrongLocalPassword', 12))"
   ```

   Paste the resulting hash into `ADMIN_PASSWORD_HASH` in `backend/.env` (not `.env.example`). Generate a JWT secret using:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Paste the result into `JWT_SECRET`. Set `NODE_ENV=development` and `PORT=3000`.
9. Start the server while still in `backend/`:

   ```powershell
   npm start
   ```

   Expected output: `Campus Placement Tracker running at http://localhost:3000`. Keep this terminal open.
10. Open **http://localhost:3000** in your browser. Do not open `index.html` directly from File Explorer; the page needs the Express API.
11. Create a drive using **Coordinator** → enter your coordinator password. Students can then apply from the opportunity card or the application form. Check the coordinator panel to review submissions.

For development with automatic server restart, use `npm run dev` in `backend/`.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Local Express port; default 3000 |
| `NODE_ENV` | Environment mode |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key used by Express; never commit or expose it |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the coordinator password, not the plain password |
| `JWT_SECRET` | Random secret used to sign short-lived coordinator tokens |

`.env.example` documents required names with placeholders. `.env` contains your private local values and is ignored by Git. Never paste real credentials into README, HTML, JavaScript or a public issue.

## Architecture

Browser (`frontend/`) → `fetch('/api/...')` → Express (`backend/server.js`) → Supabase PostgreSQL. The browser never connects directly to PostgreSQL. Coordinator-only endpoints require a signed two-hour token. The server uses the Supabase service-role key, so backend authorization checks are essential. RLS is enabled with no public policies as an additional barrier to direct browser access.

## API reference

All responses are JSON. Protected endpoints require `Authorization: Bearer <token>` from the coordinator login.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/login` | Public, rate-limited | Verify coordinator password and return short-lived token |
| GET | `/api/drives` | Public | List drives |
| POST | `/api/drives` | Coordinator | Create a drive |
| PUT | `/api/drives/:id` | Coordinator | Edit a drive |
| PATCH | `/api/drives/:id/status` | Coordinator | Open or close a drive (`{ "status": "open" }`) |
| POST | `/api/applications` | Public, rate-limited | Submit an application |
| GET | `/api/applications` | Coordinator | List applications |
| PATCH | `/api/applications/:id/status` | Coordinator | Update status (`applied`, `shortlisted`, `interview`, `selected`, `rejected`) |

Drive creation/update body: `company_name`, `role`, `description`, `min_cgpa` (0–10), `deadline` (`YYYY-MM-DD`). Application body: `student_name`, `student_email`, `roll_number`, `cgpa`, `drive_id`.

## Manual testing checklist

- `/api/health` returns JSON with `status: "ok"`.
- The home page loads drives from Supabase and the search/filter updates the visible cards.
- An application with valid details and an eligible CGPA returns success and appears in the coordinator application list.
- Missing fields, invalid email/CGPA, an expired/closed drive, or CGPA below the requirement return a validation error.
- A second application using the same roll number for the same drive returns a conflict error.
- Coordinator-only endpoints return 401 without a valid token; the wrong password is rejected.
- Coordinator can add/edit a drive and change application status; refresh and confirm data persists.
- Check layout on desktop and mobile widths.

## Troubleshooting

- **Missing environment variable:** make sure `backend/.env` exists, names match `.env.example`, and restart the server.
- **Could not load drives / database error:** check the project URL/key and verify the SQL script ran in the same Supabase project. Do not paste keys into chat or screenshots.
- **Invalid coordinator password:** regenerate the bcrypt hash and update `ADMIN_PASSWORD_HASH`, then restart.
- **Port in use:** change `PORT` in `.env` and open the corresponding localhost port.
- **Cannot connect:** keep `npm start` running and visit the URL printed in the terminal.
- **Changes not showing:** refresh the browser; if you changed server code, restart Node.

## GitHub upload

Run these commands from the **project root**, not from `backend/`:

```bash
git init
git status
git add .
git status
git commit -m "Build Campus Placement Tracker"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Create an empty repository at https://github.com/new first, then replace `YOUR_GITHUB_REPOSITORY_URL` with its HTTPS URL. If Git says the remote already exists, inspect it with `git remote -v` rather than blindly adding it again. Verify the uploaded repository contains `frontend/`, `backend/server.js`, `backend/.env.example`, `database/schema.sql` and `README.md`, but **not** `.env`, `node_modules/`, private student data or secrets. `.gitignore` does not remove a secret already committed; rotate exposed credentials immediately and remove them from history before sharing the repository.

## Security and limitations

This is an educational MVP. Public application submission can be abused despite validation and rate limiting; deploy only with additional monitoring and appropriate controls. Coordinator password is configured by the project owner. The backend's service-role key bypasses RLS, so never deploy the server without protecting its environment and routes. For production, consider Supabase Auth, stronger coordinator account management, email verification, audit logs, HTTPS deployment and privacy/retention policies. No live database or hosted deployment is included by this source bundle; configure your own Supabase project to run it.
