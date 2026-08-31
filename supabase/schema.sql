-- ============================================================
-- Adhoc Hiring Tool — Supabase schema
-- Run this once in the Supabase SQL editor for your project.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Employee master
-- The single source of truth for "who is this login email,
-- and what can they see". Populate this from your ZingHR sync
-- (or point these queries at your existing synced table).
-- ------------------------------------------------------------
create table if not exists employee_master (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  employee_code text,
  full_name text not null,
  designation text,
  role text not null check (role in ('store_manager','hod','hr','admin')),
  function text,               -- e.g. Retail Operations
  cost_center text,
  store_name text,
  store_code text,
  reports_to_email text,       -- the HOD/function head who approves this person's requisitions
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_master_role on employee_master(role);
create index if not exists idx_employee_master_reports_to on employee_master(reports_to_email);

-- Helper functions for role checks used throughout this schema's RLS
-- policies. SECURITY DEFINER means these run with the function owner's
-- privileges, bypassing RLS for their own internal query — this is what
-- avoids "infinite recursion detected in policy" errors that happen if a
-- policy ON employee_master queries employee_master directly to check the
-- current user's role (that re-triggers the same policy, forever).
-- Cross-table policies (e.g. on requisitions, checking employee_master)
-- don't strictly need this, but using it everywhere keeps every role
-- check identical and equally safe.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employee_master
    where email = auth.jwt() ->> 'email' and role = 'admin'
  );
$$;

create or replace function is_hr_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employee_master
    where email = auth.jwt() ->> 'email' and role in ('hr', 'admin')
  );
$$;

-- ------------------------------------------------------------
-- 2. Requisitions
-- One row = one worker-type request = one unique requisition ID.
-- ------------------------------------------------------------
create sequence if not exists requisition_seq;

create table if not exists requisitions (
  id uuid primary key default gen_random_uuid(),
  requisition_id text unique not null,
  batch_id uuid,               -- groups requisitions raised together in one multi-role submission

  -- who raised it
  raised_by_email text not null references employee_master(email),
  store_name text,
  store_code text,
  cost_center text,
  function text,

  -- the ask
  worker_type text not null check (worker_type in ('Florist','Helper','Rider','Chef','Supervisor')),
  tentative_rate numeric(10,2) not null check (tentative_rate > 0),
  number_of_workers integer not null check (number_of_workers > 0),
  from_date date not null,
  to_date date not null,

  -- approval routing + status
  hod_email text,
  status text not null default 'pending_hod_approval'
    check (status in ('pending_hod_approval','approved','rejected','cancelled')),
  hod_action_at timestamptz,
  hod_remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_date_range check (to_date >= from_date)
);

create index if not exists idx_requisitions_raised_by on requisitions(raised_by_email);
create index if not exists idx_requisitions_hod on requisitions(hod_email);
create index if not exists idx_requisitions_status on requisitions(status);
create index if not exists idx_requisitions_batch on requisitions(batch_id);

-- auto-generate a human-readable requisition ID: REQ-<YYMM>-<seq>
create or replace function generate_requisition_id()
returns trigger as $$
begin
  if new.requisition_id is null then
    new.requisition_id := 'REQ-' || to_char(now(), 'YYMM') || '-' ||
                           lpad(nextval('requisition_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_requisition_id on requisitions;
create trigger trg_generate_requisition_id
  before insert on requisitions
  for each row execute function generate_requisition_id();

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_requisitions_touch on requisitions;
create trigger trg_requisitions_touch
  before update on requisitions
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- 3. Requisition events (audit trail — this is what powers the
-- "HR in the loop at every stage" view later)
-- ------------------------------------------------------------
create table if not exists requisition_events (
  id uuid primary key default gen_random_uuid(),
  requisition_id text not null references requisitions(requisition_id) on delete cascade,
  event_type text not null,   -- 'raised' | 'hod_approved' | 'hod_rejected' | 'cancelled' | 'hr_notified'
  actor_email text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_requisition_events_reqid on requisition_events(requisition_id);

-- ------------------------------------------------------------
-- 4. Attendance
-- Once a requisition is approved, the store manager (and HR, for
-- oversight/backup) mark daily headcount actually present against
-- the sanctioned number_of_workers for that requisition.
-- ------------------------------------------------------------
create table if not exists requisition_attendance (
  id uuid primary key default gen_random_uuid(),
  requisition_id text not null references requisitions(requisition_id) on delete cascade,
  attendance_date date not null,
  workers_present integer not null check (workers_present >= 0),
  marked_by_email text not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisition_id, attendance_date)
);

create index if not exists idx_attendance_requisition on requisition_attendance(requisition_id);

drop trigger if exists trg_attendance_touch on requisition_attendance;
create trigger trg_attendance_touch
  before update on requisition_attendance
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- 5. Row Level Security
-- Store managers see only their own requisitions.
-- HOD sees only what's routed to them. HR/admin see everything.
-- (We only build the store-manager UI now, but wiring RLS up
-- front means the HOD/HR views can't accidentally leak data later.)
-- ------------------------------------------------------------
alter table employee_master enable row level security;
alter table requisitions enable row level security;
alter table requisition_events enable row level security;
alter table requisition_attendance enable row level security;

-- employee_master: anyone authenticated can read their own row
-- (needed to resolve role/store/cost-center after login)
drop policy if exists "read own employee record" on employee_master;
create policy "read own employee record" on employee_master
  for select using (auth.jwt() ->> 'email' = email);

-- requisitions: store manager can see/insert their own
drop policy if exists "store manager reads own requisitions" on requisitions;
create policy "store manager reads own requisitions" on requisitions
  for select using (auth.jwt() ->> 'email' = raised_by_email);

drop policy if exists "store manager inserts own requisitions" on requisitions;
create policy "store manager inserts own requisitions" on requisitions
  for insert with check (auth.jwt() ->> 'email' = raised_by_email);

-- HOD can see (and later update) requisitions routed to them
drop policy if exists "hod reads routed requisitions" on requisitions;
create policy "hod reads routed requisitions" on requisitions
  for select using (auth.jwt() ->> 'email' = hod_email);

drop policy if exists "hod updates routed requisitions" on requisitions;
create policy "hod updates routed requisitions" on requisitions
  for update using (auth.jwt() ->> 'email' = hod_email);

-- HR/admin: full read access
drop policy if exists "hr admin reads all requisitions" on requisitions;
create policy "hr admin reads all requisitions" on requisitions
  for select using (is_hr_or_admin());

-- requisition_events: readable by anyone who can read the parent requisition
drop policy if exists "read events for visible requisitions" on requisition_events;
create policy "read events for visible requisitions" on requisition_events
  for select using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_events.requisition_id
    )
  );

drop policy if exists "insert own events" on requisition_events;
create policy "insert own events" on requisition_events
  for insert with check (auth.jwt() ->> 'email' = actor_email);

-- requisition_attendance: store manager can mark/view attendance for their
-- own requisitions, but only once approved (matches "responsibility of
-- manager and HR" once hiring is actually sanctioned)
drop policy if exists "store manager marks own attendance" on requisition_attendance;
create policy "store manager marks own attendance" on requisition_attendance
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
    )
  );

-- HR/admin: full access to attendance too, per the brief — but blocked
-- once frozen, same as the store manager policy above. The only way past
-- a freeze is the dedicated unfreeze action (admin-only, at the app
-- layer), which updates requisitions.attendance_frozen directly and is
-- covered by the "hr admin updates requisitions" policy — not this one.
drop policy if exists "hr admin full access to attendance" on requisition_attendance;
create policy "hr admin full access to attendance" on requisition_attendance
  for all using (
    is_hr_or_admin()
    and exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.attendance_frozen = false
    )
  )
  with check (
    is_hr_or_admin()
    and exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.attendance_frozen = false
    )
  );

-- ------------------------------------------------------------
-- Sample seed data — DELETE before going live. Useful for
-- testing the store manager view end to end.
-- ------------------------------------------------------------
-- insert into employee_master (email, full_name, role, function, cost_center, store_name, store_code, reports_to_email)
-- values
--   ('store.manager@fnp.com', 'Test Store Manager', 'store_manager', 'Retail', 'CC-DEL-01', 'FNP Store - GK1', 'DEL045', 'hod@fnp.com'),
--   ('hod@fnp.com', 'Test HOD', 'hod', 'Retail', 'CC-DEL-01', null, null, null),
--   ('hr@fnp.com', 'Test HR', 'hr', 'HR', null, null, null, null);

-- ============================================================
-- MIGRATION 2 — Vendors, admin management, HOD/HR write access
-- (added after the initial store-manager build; run this whole
-- block once in the SQL Editor even if you already ran schema.sql,
-- since CREATE TABLE IF NOT EXISTS won't add columns to a table
-- that already exists)
-- ============================================================

-- ------------------------------------------------------------
-- 6. Vendors — the manpower suppliers HR assigns against
--    approved requisitions.
-- ------------------------------------------------------------
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_vendors_touch on vendors;
create trigger trg_vendors_touch
  before update on vendors
  for each row execute function touch_updated_at();

alter table vendors enable row level security;

-- Anyone signed in with an employee_master row can read the active
-- vendor list (needed for the HR assignment dropdown); only admin
-- manages the list itself.
drop policy if exists "authenticated employees read vendors" on vendors;
create policy "authenticated employees read vendors" on vendors
  for select using (
    exists (select 1 from employee_master em where em.email = auth.jwt() ->> 'email')
  );

drop policy if exists "admin manages vendors" on vendors;
create policy "admin manages vendors" on vendors
  for all using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- 7. Vendor assignment on requisitions — HR maps a vendor once
--    a requisition is approved, since that vendor supplies the
--    actual headcount.
-- ------------------------------------------------------------
alter table requisitions add column if not exists vendor_id uuid references vendors(id);
alter table requisitions add column if not exists vendor_assigned_by text;
alter table requisitions add column if not exists vendor_assigned_at timestamptz;
create index if not exists idx_requisitions_vendor on requisitions(vendor_id);

-- HR/admin can update requisitions (in practice, only the vendor_*
-- columns via the app's HR view — RLS can't restrict to specific
-- columns, so this trusts the application layer the same way the
-- rest of this schema already does)
drop policy if exists "hr admin updates requisitions" on requisitions;
create policy "hr admin updates requisitions" on requisitions
  for update using (is_hr_or_admin())
  with check (is_hr_or_admin());

-- ------------------------------------------------------------
-- 8. Admin management of employee_master — replaces hand-written
--    SQL inserts with a real UI for adding people and mapping
--    store/cost-center/HOD.
--
-- IMPORTANT: these two policies check role via is_admin(), NOT a
-- direct subquery on employee_master — a policy ON employee_master
-- that subqueries employee_master directly causes Postgres error
-- 42P17 "infinite recursion detected in policy", since evaluating
-- the policy re-triggers the same policy. is_admin() is SECURITY
-- DEFINER, so its internal query bypasses RLS and breaks the cycle.
-- ------------------------------------------------------------
drop policy if exists "admin reads all employee records" on employee_master;
create policy "admin reads all employee records" on employee_master
  for select using (is_admin());

drop policy if exists "admin manages employee records" on employee_master;
create policy "admin manages employee records" on employee_master
  for all using (is_admin())
  with check (is_admin());

-- ============================================================
-- MIGRATION 3 — Reminders, bulk actions support
-- ============================================================
alter table requisitions add column if not exists last_reminder_at timestamptz;

-- ============================================================
-- MIGRATION 4 — Attendance freeze + reminder tracking
-- ============================================================
alter table requisitions add column if not exists attendance_last_reminder_at timestamptz;
alter table requisitions add column if not exists attendance_frozen boolean not null default false;
alter table requisitions add column if not exists attendance_frozen_at timestamptz;

-- ============================================================
-- MIGRATION 5 — Reason for requisition
-- ============================================================
alter table requisitions add column if not exists reason text;
alter table requisitions add column if not exists reason_other text;

alter table requisitions drop constraint if exists requisitions_reason_check;
alter table requisitions add constraint requisitions_reason_check
  check (reason is null or reason in (
    'Festival / Occasion',
    'Manpower Shortage / Absenteeism',
    'Multiple Orders',
    'Other'
  ));

-- ============================================================
-- MIGRATION 6 — Worker-wise attendance (Full Day / Half Day /
-- Absent / Leave per worker per day, replacing the old single
-- daily headcount number). Adhoc daily-wage workers aren't
-- registered anywhere else in the system, so worker slots are
-- auto-generated ("Worker 1".."Worker N") the first time the
-- attendance page is opened for an approved requisition — the
-- store manager can rename any slot to a real name if they want.
-- ============================================================

create table if not exists requisition_workers (
  id uuid primary key default gen_random_uuid(),
  requisition_id text not null references requisitions(requisition_id) on delete cascade,
  slot_number integer not null,
  worker_name text,
  created_at timestamptz not null default now(),
  unique (requisition_id, slot_number)
);

create index if not exists idx_requisition_workers_req on requisition_workers(requisition_id);

alter table requisition_attendance add column if not exists requisition_worker_id uuid references requisition_workers(id) on delete cascade;
alter table requisition_attendance add column if not exists status text check (status in ('full_day','half_day','absent','leave'));

-- The old model had one row per requisition per day (an aggregate
-- headcount). The new model has one row per WORKER per day, so the old
-- uniqueness rule (one row per requisition+date) has to go — multiple
-- workers now legitimately share the same requisition_id + date.
alter table requisition_attendance drop constraint if exists requisition_attendance_requisition_id_attendance_date_key;
drop index if exists requisition_attendance_requisition_id_attendance_date_key;

alter table requisition_attendance drop constraint if exists requisition_attendance_worker_date_unique;
alter table requisition_attendance add constraint requisition_attendance_worker_date_unique
  unique (requisition_worker_id, attendance_date);

-- requisition_workers RLS: same visibility/edit rules as attendance
-- itself — the store manager who raised it (once approved, not frozen),
-- or HR/admin.
alter table requisition_workers enable row level security;

drop policy if exists "store manager manages own workers" on requisition_workers;
create policy "store manager manages own workers" on requisition_workers
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
    )
  );

drop policy if exists "hr admin manages workers" on requisition_workers;
create policy "hr admin manages workers" on requisition_workers
  for all using (
    is_hr_or_admin()
    and exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.attendance_frozen = false
    )
  )
  with check (
    is_hr_or_admin()
    and exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.attendance_frozen = false
    )
  );

-- ============================================================
-- MIGRATION 7 — Payments: HR sets a final per-day rate per
-- worker, tracks payment status and remarks, independent of
-- whether the attendance register itself is locked (payment
-- reconciliation is a separate concern from attendance-marking
-- integrity, and often happens after a register is frozen).
-- ============================================================
alter table requisition_workers add column if not exists rate_per_day numeric(10,2);
alter table requisition_workers add column if not exists payment_status text not null default 'pending'
  check (payment_status in ('pending', 'partially_paid', 'paid'));
alter table requisition_workers add column if not exists payment_remarks text;
alter table requisition_workers add column if not exists payment_updated_by text;
alter table requisition_workers add column if not exists payment_updated_at timestamptz;

-- A dedicated, unfrozen-independent update policy for HR/admin. The
-- existing "hr admin manages workers" policy (from Migration 6) already
-- covers general worker edits but is gated on attendance_frozen = false
-- to match attendance-marking rules — payment reconciliation shouldn't
-- be blocked by that, since it commonly happens after a register locks.
-- The app layer (not this policy) is what actually restricts which
-- columns a given action touches — see updatePaymentInfo.
drop policy if exists "hr admin updates payment info" on requisition_workers;
create policy "hr admin updates payment info" on requisition_workers
  for update using (is_hr_or_admin())
  with check (is_hr_or_admin());

-- ============================================================
-- MIGRATION 8 — Invoice reference, attendance-to-payment
-- turnaround tracking, and the data needed for fuller exports.
-- ============================================================
alter table requisitions add column if not exists invoice_number text;
alter table requisitions add column if not exists invoice_file_url text;
alter table requisitions add column if not exists attendance_completed_at timestamptz;
alter table requisition_workers add column if not exists paid_at timestamptz;

-- ============================================================
-- MIGRATION 9 — Fix: drop the old workers_present column.
-- Migration 6 redesigned this table to be worker-wise (one row
-- per worker per day, via requisition_worker_id + status) but
-- never removed the original aggregate column, which still had
-- a NOT NULL constraint — every new-style insert was failing
-- with "null value in column workers_present violates not-null
-- constraint" since nothing sets it anymore. This is a genuine
-- gap in that migration, not a config issue on your end.
-- ============================================================
alter table requisition_attendance drop column if exists workers_present;

-- ============================================================
-- MIGRATION 10 — Once a requisition is fully paid (every worker
-- on it marked "paid"), lock it to admin-only edits. HR and the
-- store manager retain read access but can no longer touch
-- attendance, worker payment info, or the requisition record
-- itself (including invoice fields). Admin is unaffected.
-- ============================================================
alter table requisitions add column if not exists fully_paid_at timestamptz;

-- Attendance — store manager
drop policy if exists "store manager marks own attendance" on requisition_attendance;
create policy "store manager marks own attendance" on requisition_attendance
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
        and r.fully_paid_at is null
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
        and r.fully_paid_at is null
    )
  );

-- Attendance — HR/admin. Admin keeps access even once fully paid;
-- HR loses it once fully paid, same as everyone but admin.
drop policy if exists "hr admin full access to attendance" on requisition_attendance;
create policy "hr admin full access to attendance" on requisition_attendance
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.attendance_frozen = false
        and (is_admin() or (is_hr_or_admin() and r.fully_paid_at is null))
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_attendance.requisition_id
        and r.attendance_frozen = false
        and (is_admin() or (is_hr_or_admin() and r.fully_paid_at is null))
    )
  );

-- Worker records (names etc.) — store manager
drop policy if exists "store manager manages own workers" on requisition_workers;
create policy "store manager manages own workers" on requisition_workers
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
        and r.fully_paid_at is null
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.raised_by_email = auth.jwt() ->> 'email'
        and r.status = 'approved'
        and r.attendance_frozen = false
        and r.fully_paid_at is null
    )
  );

-- Worker records — HR/admin
drop policy if exists "hr admin manages workers" on requisition_workers;
create policy "hr admin manages workers" on requisition_workers
  for all using (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.attendance_frozen = false
        and (is_admin() or (is_hr_or_admin() and r.fully_paid_at is null))
    )
  )
  with check (
    exists (
      select 1 from requisitions r
      where r.requisition_id = requisition_workers.requisition_id
        and r.attendance_frozen = false
        and (is_admin() or (is_hr_or_admin() and r.fully_paid_at is null))
    )
  );

-- Payment info itself (rate/status/remarks) — the critical one. HR can
-- still complete the transition INTO fully-paid (fully_paid_at is still
-- null in requisitions at the moment that last save happens — it only
-- gets set afterward, once this update has already succeeded), but
-- can't touch anything on an ALREADY fully-paid requisition after that.
drop policy if exists "hr admin updates payment info" on requisition_workers;
create policy "hr admin updates payment info" on requisition_workers
  for update using (
    is_admin()
    or (
      is_hr_or_admin()
      and exists (
        select 1 from requisitions r
        where r.requisition_id = requisition_workers.requisition_id
          and r.fully_paid_at is null
      )
    )
  )
  with check (
    is_admin()
    or (
      is_hr_or_admin()
      and exists (
        select 1 from requisitions r
        where r.requisition_id = requisition_workers.requisition_id
          and r.fully_paid_at is null
      )
    )
  );

-- The requisition record itself (invoice fields etc.)
drop policy if exists "hr admin updates requisitions" on requisitions;
create policy "hr admin updates requisitions" on requisitions
  for update using (is_admin() or (is_hr_or_admin() and fully_paid_at is null))
  with check (is_admin() or (is_hr_or_admin() and fully_paid_at is null));
