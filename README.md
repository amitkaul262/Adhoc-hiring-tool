# FNP Adhoc Hiring Tool — Store Manager view (v0.1)

Store managers raise adhoc manpower requisitions, which route to their HOD
for approval by email, with HR cc'd on every step. This first pass ships
the **store manager** experience end to end: login, dashboard, raise
requisition, track status. HOD and HR views come next.

## Stack
Next.js 14 (App Router) · Supabase (Postgres + Auth) · Brevo SMTP via Nodemailer · deployed on Vercel.

## What's built
- **Magic-link login** — store manager enters their work email, Supabase
  emails a sign-in link, no passwords to manage.
- **Dashboard** — pulls store, cost center, function, and reporting HOD
  from `employee_master` using the logged-in email; lists their past
  requisitions with live status.
- **Raise requisition** — form for worker type (Florist / Helper / Rider /
  Chef / Supervisor), tentative rate, headcount, and date range. One
  submission = one worker type = one requisition, each with its own
  auto-generated ID (`REQ-2608-0001` style).
- **On submit**: requisition is saved, an audit event is logged, and an
  email goes to the HOD (cc HR) with a link straight to that requisition.
- **Requisition detail page** — status, full details, and an activity/audit
  trail — this is the same page the HOD's email link will point to once
  their approve/reject actions are wired up.
- Full **RLS policies** for `hod` and `hr`/`admin` roles are already in the
  schema (commented for now where they gate on future UI), so the HOD and
  HR builds slot in without re-touching data access.

## Setup

### 1. Supabase
1. Create a project (or use an existing one).
2. Run `supabase/schema.sql` in the SQL editor. It creates
   `employee_master`, `requisitions`, `requisition_events`, the
   requisition-ID generator, and RLS policies.
3. Populate `employee_master`. If you already have an employee master
   table (e.g. from your ZingHR sync), either point these queries at it or
   sync into this table — the important columns are `email`, `role`
   (`store_manager` / `hod` / `hr` / `admin`), `store_name`, `store_code`,
   `cost_center`, `function`, and `reports_to_email` (the HOD each store
   manager's requisitions route to).
4. In Supabase Auth settings, enable the **Email** provider with magic
   link / OTP (this is on by default). Add your production URL to
   **Redirect URLs**: `https://your-app.vercel.app/auth/callback`.

### 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the same keys
in Vercel → Project → Settings → Environment Variables.

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from
  Supabase → Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — same page. Server-only, never exposed to
  the client; not used by the store manager flow yet but wired in for the
  HOD/HR builds.
- `NEXT_PUBLIC_APP_URL` — your deployed URL, used to build the links inside
  emails.
- `SMTP_*` / `EMAIL_FROM` — Brevo SMTP credentials (same pattern as Rose).
- `HR_TEAM_EMAILS` — comma-separated list, cc'd on every requisition email
  so HR stays in the loop at every stage.

### 3. Run locally
```bash
npm install
npm run dev
```

### 4. Deploy
```bash
git init && git add . && git commit -m "adhoc hiring tool: store manager view"
git remote add origin <your-repo>
git push -u origin main
```
Then import the repo in Vercel and add the environment variables above.

## Notes / decisions worth knowing about
- **Requisition granularity**: one form submission = one worker type = one
  requisition ID. If a store manager needs 3 Florists and 2 Chefs, that's
  two separate requisitions. Say the word if you actually want a single
  requisition to bundle multiple roles — it's a schema change (a
  `requisition_lines` child table), not a huge one, but better to confirm
  before HOD/HR views are built on top of the current shape.
- **Auth**: passwordless magic link, gated by an active `employee_master`
  row. Someone authenticated but not (yet) in `employee_master` sees a
  "not yet set up" message rather than an error.
- **Non-store-manager logins**: HOD/HR/admin accounts can log in already —
  they just see a "your view is coming soon" placeholder until we build
  their dashboards next.
- Google Fonts (Fraunces/Inter) are loaded via `next/font/google`, which
  needs network access at build time — this fails in fully offline
  sandboxes but works normally on Vercel and in local dev with internet.

## Next up
HOD dashboard (approve/reject with remarks, own-queue view) and HR
dashboard (cross-function visibility, audit trail) — say the word when
you're ready and I'll build those against this same schema.
