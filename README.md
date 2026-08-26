# FNP Adhoc Hiring Tool (v0.3)

Store managers raise adhoc manpower requisitions → routes to their HOD for
approval by email → HR maps a vendor once approved → everyone stays in the
loop by email throughout. Admin manages who's who without touching SQL.

## Stack
Next.js 14 (App Router) · Supabase (Postgres + Auth) · Google Apps Script
email relay (free, no SMTP/App Password) · deployed on Vercel.

## App shell
A proper persistent sidebar + top bar, not a bare content page — routes
requiring auth live under an `(app)` route group with a shared layout
(`app/(app)/layout.js`) that:
- Resolves the current employee once (memoized via React `cache()`, so
  the shell and the page itself don't double-query Supabase).
- Renders `TopBar` (logo, live notification bell, user avatar, sign out)
  and `Sidebar` (role-aware nav — Home always, "Raise Requisition" for
  store managers, "Audit Log" for HR/admin, "People"/"Vendors" for admin)
  around whatever page is active.
- Handles the "you're signed in but not provisioned" fallback centrally,
  so individual pages don't each need that check.
- Collapses the sidebar to icon-only on narrow/mobile screens.

`/login` and `/auth/callback` sit outside this group, since there's no
employee to show a shell for yet.

## Views, by role

**Store Manager** (`/dashboard`)
- Profile card (store, cost center, function, reporting HOD) pulled from
  `employee_master`.
- Raise a requisition — select one or several worker types at once (each
  gets its own headcount/rate), one shared date range, submitted as a
  batch but saved as independent requisitions.
- Their own requisition history with live status.
- **Mark daily attendance on approved requisitions** — a proper register:
  date, day of week, weekend rows shaded, present/absent per day, a live
  status pill (Full / Partial / None / Not marked), and a summary footer
  (days marked, total person-days present, attendance rate).

**HOD** (`/dashboard`)
- Queue of requisitions routed to them, split into "awaiting your
  approval" and "past decisions" — with a KPI strip (awaiting count,
  approved, rejected, average decision time) and an age badge per pending
  requisition ("2 days waiting").
- **Bulk approve**: select several pending requisitions via checkboxes,
  add one optional shared note, approve them all in one action. Individual
  approve/reject with a specific reason still happens on the requisition
  detail page — bulk is for approve only, since rejections usually need
  their own reason per item.
- Either path triggers an email back to the store manager (cc HR).

**HR** (`/dashboard`)
- Org-wide view of every requisition, with a KPI strip and a **filter
  bar** (status, role, store, function, date range) that persists in the
  URL — shareable, bookmarkable, survives a refresh.
- "Needs a vendor" queue at the top, filters apply here too.
- **Export CSV** of the current filtered list.
- Link to the **audit log** — a single searchable timeline of every event
  across every requisition (raised, notified, approved, rejected, vendor
  assigned, reminder sent), filterable by event type and actor.
- (Admin users see this same view, plus a link into the admin panel.)

**Admin** (`/admin`)
- **People** — add/edit anyone in `employee_master`.
- **Vendors** — add/edit manpower suppliers.

**Store Manager** (`/dashboard`)
- Profile card, multi-role raise-requisition form, own requisition
  history, attendance register.
- **Clone**: "Raise similar" on a past requisition prefills the form with
  the same role/rate/headcount — just the dates need changing.

**Everyone**
- **Notification bell** in the nav bar — shows a live count of items
  needing your specific action (pending approvals for HOD, unassigned
  vendors for HR/admin), links straight to the relevant queue.
- **Auto-reminders**: a daily background job (`/api/cron/reminders`, see
  Setup) emails the HOD (cc HR) for any requisition still pending after
  24h, and won't re-remind the same one again within another 24h.

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
- `CRON_SECRET` — any random string. Set it in Vercel, and Vercel
  automatically sends it as the `Authorization: Bearer <value>` header
  when it triggers `/api/cron/reminders` on schedule — this is what stops
  a stranger from hitting that URL directly and spamming reminder emails.
  The route rejects any request without a matching header.

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
change. The new audit log page and CSV exports cover a good chunk of
ad-hoc reporting needs in the meantime.

## Cron jobs — a plan-specific note
Vercel's free Hobby plan only allows cron jobs to run **once per day** —
anything more frequent fails at deploy time, not silently. The reminders
job is set to once daily (`0 9 * * *`, 9am UTC), which is also genuinely
all it needs given the 24h reminder-dedup logic already in the route. If
you're on Vercel Pro and want tighter timing, you can safely change the
schedule in `vercel.json` — the route's own dedup logic means running it
more often just means "check sooner," not "spam more."
