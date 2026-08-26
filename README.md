# FNP Adhoc Hiring Tool (v0.3)

Store managers raise adhoc manpower requisitions → routes to their HOD for
approval by email → HR maps a vendor once approved → everyone stays in the
loop by email throughout. Admin manages who's who without touching SQL.

## Stack
Next.js 14 (App Router) · Supabase (Postgres + Auth) · Google Apps Script
email relay (free, no SMTP/App Password) · deployed on Vercel.

## Views, by role

**Store Manager** (`/dashboard`)
- Profile card (store, cost center, function, reporting HOD) pulled from
  `employee_master`.
- Raise a requisition — select one or several worker types at once (each
  gets its own headcount/rate), one shared date range, submitted as a
  batch but saved as independent requisitions.
- Their own requisition history with live status.
- Mark daily attendance on approved requisitions.

**HOD** (`/dashboard`)
- Queue of requisitions routed to them, split into "awaiting your
  approval" and "past decisions."
- Approve or reject straight from the requisition detail page — reject
  requires a reason, approve's is optional. Either way triggers an email
  back to the store manager (cc HR).

**HR** (`/dashboard`)
- Org-wide view of every requisition, not just their own store/function.
- "Needs a vendor" queue at the top — every approved requisition without a
  vendor assigned yet, with an inline dropdown to assign one right there.
- Full requisition list below for general visibility.
- (Admin users see this same view, plus a link into the admin panel.)

**Admin** (`/admin`)
- **People** — add/edit anyone in `employee_master`: their role
  (store manager / HOD / HR / admin), store, cost center, function, and
  which HOD their requisitions route to. Replaces hand-written SQL inserts
  entirely.
- **Vendors** — add/edit the manpower suppliers HR picks from when
  assigning headcount. Name, contact info, active/inactive.

## Setup

### 1. Supabase
1. Create a project.
2. Run `supabase/schema.sql` in the SQL editor, top to bottom — it's
   organized as dated migrations, so running the whole file on a fresh
   project sets everything up in order. **If you already ran an earlier
   version of this file**, re-running it won't retroactively add new
   columns to tables that already exist (`CREATE TABLE IF NOT EXISTS`
   skips existing tables entirely) — you'll need the specific `ALTER
   TABLE` statements from whichever migration block is new to you. Check
   Supabase's Logs → Postgres Logs if a save ever fails with a vague
   error — it'll show you exactly which column or table is missing.
3. Populate `employee_master` and `vendors` — now doable entirely from
   the Admin panel once the app is running, no more manual SQL needed.
4. Enable Google as an Auth provider (Authentication → Providers →
   Google), using an OAuth client from Google Cloud Console. Set the
   **Site URL** (Authentication → URL Configuration) to your real deployed
   URL, not the `localhost:3000` default — this is what Supabase redirects
   to after sign-in, and leaving it on the default sends real users back
   to a dead `localhost` address. Add both your production and (if
   testing locally) `localhost:3000` callback URLs to **Redirect URLs**.

### 2. Environment variables
Copy `.env.example` to `.env.local` for local dev, and add the same keys
in Vercel → Project → Settings → Environment Variables.

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API.
- `NEXT_PUBLIC_APP_URL` — your deployed URL, used to build links inside
  emails.
- `APPS_SCRIPT_URL` / `APPS_SCRIPT_SECRET` — the Google Apps Script email
  relay. Deploy `apps-script/Code.gs` as a Web App per the comments at the
  top of that file, then paste its `/exec` URL and your chosen secret
  here (same secret goes into the script's `SHARED_SECRET` property).
- `HR_TEAM_EMAILS` — comma-separated, cc'd on every requisition email.

### 3. Run locally
```bash
npm install
npm run dev
```

### 4. Deploy
Push to GitHub, import the repo in Vercel, add the environment variables
above, deploy.

## Notes / decisions worth knowing about
- **Requisition granularity**: multi-role select in one submission, but
  each role is still its own requisition with its own ID, grouped by a
  shared `batch_id`. Independently approvable — a HOD could approve the
  Florist line and reject the Chef line in the same batch.
- **Vendor assignment**: one vendor per requisition (not per individual
  worker) — matches the fact that a requisition's headcount for one role
  typically comes from one supplier. If a requisition ever needs to split
  its headcount across multiple vendors, that's a real schema change
  (a `requisition_vendor_splits` table), not a small tweak — flag it if
  that's actually how sourcing works before reports get built on the
  current shape.
- **Editing people**: email is locked once a person exists, since
  `raised_by_email`/`hod_email` reference it directly — change their role,
  store, or reporting HOD freely, but a genuine email change means
  deactivating the old row and adding a new one.
- **Attendance**: store manager or HR only, once approved — see
  `/requisitions/[id]/attendance`, schema in `requisition_attendance`.
- **Preview mode**: `lib/mockData.js` has `PREVIEW_MODE`, currently
  `false` (live). Flipping it to `true` bypasses auth and Supabase
  entirely with mock data — handy for reviewing UI changes before wiring
  up new schema, but the HOD/HR/Admin views weren't given their own mock
  scenarios (built after preview mode's job was mostly done) — they'll
  render using the same store-manager-flavored sample data rather than
  anything role-appropriate.
- Google Fonts (Fraunces/Inter) load via `next/font/google`, which needs
  network access at build time — works fine on Vercel and local dev with
  internet, not in fully offline sandboxes.

## Deferred — reports
Vendor-wise and function-wise extraction/reporting was explicitly scoped
out for a later pass. The schema already captures what reports will need
(`vendor_id` on every requisition, `function`/`cost_center` denormalized
onto every row, full `requisition_events` audit trail) — so when it's
time, it's a reporting layer on top of existing data, not a data model
change.
