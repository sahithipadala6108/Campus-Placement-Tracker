-- Campus Placement Tracker schema
-- Run this entire script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.placement_drives (
  id uuid primary key default gen_random_uuid(),
  company_name varchar(100) not null check (char_length(trim(company_name)) > 0),
  role varchar(100) not null check (char_length(trim(role)) > 0),
  description varchar(1000) not null check (char_length(trim(description)) > 0),
  min_cgpa numeric(3,2) not null default 6.00 check (min_cgpa >= 0 and min_cgpa <= 10),
  deadline date not null,
  status varchar(10) not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid not null references public.placement_drives(id) on delete restrict,
  student_name varchar(100) not null check (char_length(trim(student_name)) > 0),
  student_email varchar(254) not null check (position('@' in student_email) > 1),
  roll_number varchar(30) not null check (char_length(trim(roll_number)) > 0),
  cgpa numeric(3,2) not null check (cgpa >= 0 and cgpa <= 10),
  status varchar(20) not null default 'applied' check (status in ('applied','shortlisted','interview','selected','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drive_id, roll_number)
);

create index if not exists idx_drives_status_deadline on public.placement_drives(status, deadline);
create index if not exists idx_applications_drive_id on public.applications(drive_id);
create index if not exists idx_applications_roll_number on public.applications(roll_number);
create index if not exists idx_applications_created_at on public.applications(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists placement_drives_set_updated_at on public.placement_drives;
create trigger placement_drives_set_updated_at before update on public.placement_drives for each row execute function public.set_updated_at();
drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications for each row execute function public.set_updated_at();

-- The Express server uses a server-only service-role key and performs API authorization.
-- Keep RLS enabled so direct client access is blocked unless explicit policies are added.
alter table public.placement_drives enable row level security;
alter table public.applications enable row level security;
-- Intentionally create no anon/authenticated policies: all database access goes through Express.

-- Optional demo data: uncomment and edit deadlines before running if you want sample drives.
-- insert into public.placement_drives(company_name, role, description, min_cgpa, deadline)
-- values ('Northstar Technologies','Graduate Engineer Trainee','Entry-level engineering role with technical training.',6.00,current_date + 30),
--        ('BluePeak Systems','Junior Software Developer','Build and test web applications with a development team.',7.00,current_date + 21);
