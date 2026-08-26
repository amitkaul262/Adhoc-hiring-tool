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

-- ------------------------------------------------------------
-- 2. Requisitions
-- One row = one worker-type request = one unique requisition ID.
-- ------------------------------------------------------------
create sequence if not exists requisition_seq;

create table if not exists requisitions (
  id uuid primary key default gen_random_uuid(),
  requisition_id text unique not null,

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
-- 4. Row Level Security
-- Store managers see only their own requisitions.
-- HOD sees only what's routed to them. HR/admin see everything.
-- (We only build the store-manager UI now, but wiring RLS up
-- front means the HOD/HR views can't accidentally leak data later.)
-- ------------------------------------------------------------
alter table employee_master enable row level security;
alter table requisitions enable row level security;
alter table requisition_events enable row level security;

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
  for select using (
    exists (
      select 1 from employee_master em
      where em.email = auth.jwt() ->> 'email'
        and em.role in ('hr','admin')
    )
  );

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

-- ------------------------------------------------------------
-- Sample seed data — DELETE before going live. Useful for
-- testing the store manager view end to end.
-- ------------------------------------------------------------
-- insert into employee_master (email, full_name, role, function, cost_center, store_name, store_code, reports_to_email)
-- values
--   ('store.manager@fnp.com', 'Test Store Manager', 'store_manager', 'Retail', 'CC-DEL-01', 'FNP Store - GK1', 'DEL045', 'hod@fnp.com'),
--   ('hod@fnp.com', 'Test HOD', 'hod', 'Retail', 'CC-DEL-01', null, null, null),
--   ('hr@fnp.com', 'Test HR', 'hr', 'HR', null, null, null, null);
