-- VocaSafe Lab D4 initial schema
-- Draft production-like schema with initial RLS policies. Harden in D4-13.
-- This migration is intended to be applied once by Supabase migration tracking.
-- It is not fully idempotent for manual repeated execution because it creates enums, policies, and tables.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('mahasiswa', 'dosen', 'teknisi', 'kepala_lab', 'admin');
create type public.report_status as enum ('baru', 'diverifikasi', 'dalam_penanganan', 'selesai', 'ditolak');
create type public.risk_category as enum ('rendah', 'sedang', 'tinggi', 'kritis');
create type public.asset_status as enum ('layak', 'perlu_dicek', 'tidak_layak');
create type public.asset_kind as enum ('alat', 'fasilitas');
create type public.checklist_answer as enum ('ya', 'tidak', 'tidak_berlaku');

create table public.laboratories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  department text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role public.user_role not null,
  laboratory_id uuid references public.laboratories(id) null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sops (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories(id) on delete set null,
  title text not null,
  version text,
  last_updated_at timestamptz,
  required_ppe text[] default '{}',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories(id) on delete set null,
  sop_id uuid references public.sops(id) on delete set null,
  code text unique not null,
  name text not null,
  kind public.asset_kind not null,
  category text,
  location text,
  description text,
  status public.asset_status not null default 'layak',
  qr_payload text unique,
  last_inspection_at timestamptz,
  next_inspection_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.k3_facilities (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  name text not null,
  facility_type text not null,
  location text,
  status public.asset_status not null default 'layak',
  last_checked_at timestamptz,
  next_check_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.risk_points (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null,
  description text,
  severity int check (severity between 1 and 5),
  probability int check (probability between 1 and 5),
  exposure int check (exposure between 1 and 5),
  score int check (score between 1 and 125),
  category public.risk_category,
  recommendation text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_number text unique not null,
  asset_id uuid references public.assets(id) on delete set null,
  laboratory_id uuid references public.laboratories(id) on delete set null,
  reporter_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  description text not null,
  location text,
  status public.report_status not null default 'baru',
  severity int not null check (severity between 1 and 5),
  probability int not null check (probability between 1 and 5),
  exposure int not null check (exposure between 1 and 5),
  risk_score int not null check (risk_score between 1 and 125),
  risk_category public.risk_category not null,
  recommendation text,
  ai_recommendation text,
  reported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.report_followups (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  status public.report_status not null,
  note text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  bucket text not null,
  path text not null,
  file_name text,
  mime_type text,
  size_bytes int check (size_bytes >= 0),
  uploaded_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references public.laboratories(id) on delete set null,
  title text not null,
  asset_kind public.asset_kind,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  is_critical boolean not null default false,
  guidance text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table public.checklist_results (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.checklist_templates(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  laboratory_id uuid references public.laboratories(id) on delete set null,
  inspector_id uuid references public.user_profiles(id) on delete set null,
  completed_at timestamptz default now(),
  overall_note text,
  has_risk_finding boolean not null default false,
  severity int check (severity between 1 and 5),
  probability int check (probability between 1 and 5),
  exposure int check (exposure between 1 and 5),
  risk_score int check (risk_score between 1 and 125),
  risk_category public.risk_category,
  recommendation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.checklist_result_items (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.checklist_results(id) on delete cascade,
  item_id uuid references public.checklist_items(id) on delete set null,
  answer public.checklist_answer not null,
  note text,
  created_at timestamptz default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_user_profiles_email on public.user_profiles(email);
create index idx_user_profiles_role on public.user_profiles(role);
create index idx_user_profiles_laboratory_id on public.user_profiles(laboratory_id);
create index idx_laboratories_code on public.laboratories(code);
create index idx_assets_code on public.assets(code);
create index idx_assets_laboratory_id on public.assets(laboratory_id);
create index idx_assets_status on public.assets(status);
create index idx_assets_kind on public.assets(kind);
create index idx_sops_laboratory_id on public.sops(laboratory_id);
create index idx_reports_report_number on public.reports(report_number);
create index idx_reports_asset_id on public.reports(asset_id);
create index idx_reports_laboratory_id on public.reports(laboratory_id);
create index idx_reports_reporter_id on public.reports(reporter_id);
create index idx_reports_status on public.reports(status);
create index idx_reports_risk_category on public.reports(risk_category);
create index idx_reports_reported_at on public.reports(reported_at);
create index idx_report_followups_report_id on public.report_followups(report_id);
create index idx_report_followups_created_by on public.report_followups(created_by);
create index idx_report_attachments_report_id on public.report_attachments(report_id);
create index idx_checklist_templates_laboratory_id on public.checklist_templates(laboratory_id);
create index idx_checklist_templates_is_active on public.checklist_templates(is_active);
create index idx_checklist_items_template_id on public.checklist_items(template_id);
create index idx_checklist_results_asset_id on public.checklist_results(asset_id);
create index idx_checklist_results_laboratory_id on public.checklist_results(laboratory_id);
create index idx_checklist_results_inspector_id on public.checklist_results(inspector_id);
create index idx_checklist_results_completed_at on public.checklist_results(completed_at);
create index idx_checklist_result_items_result_id on public.checklist_result_items(result_id);
create index idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index idx_audit_logs_entity_table on public.audit_logs(entity_table);
create index idx_audit_logs_created_at on public.audit_logs(created_at);

-- Role helpers. Keep search_path fixed for security definer functions.
create or replace function public.get_current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.user_profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_current_user_role() = 'admin';
$$;

create or replace function public.is_teknisi_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_current_user_role() in ('teknisi', 'admin');
$$;

-- Enable RLS
alter table public.laboratories enable row level security;
alter table public.user_profiles enable row level security;
alter table public.sops enable row level security;
alter table public.assets enable row level security;
alter table public.k3_facilities enable row level security;
alter table public.risk_points enable row level security;
alter table public.reports enable row level security;
alter table public.report_followups enable row level security;
alter table public.report_attachments enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_results enable row level security;
alter table public.checklist_result_items enable row level security;
alter table public.audit_logs enable row level security;

-- Basic read policies
create policy "authenticated can read laboratories" on public.laboratories for select to authenticated using (true);
create policy "authenticated can read assets" on public.assets for select to authenticated using (true);
create policy "authenticated can read sops" on public.sops for select to authenticated using (true);
create policy "users can read own profile" on public.user_profiles for select to authenticated using (id = auth.uid());
create policy "admin can read all profiles" on public.user_profiles for select to authenticated using (public.is_admin());

-- Admin master data policies
create policy "admin can write laboratories" on public.laboratories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write assets" on public.assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write sops" on public.sops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write k3 facilities" on public.k3_facilities for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write checklist templates" on public.checklist_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write checklist items" on public.checklist_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin can write risk points" on public.risk_points for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Reports
create policy "authenticated can read reports" on public.reports for select to authenticated using (true);
create policy "allowed roles can insert reports" on public.reports for insert to authenticated with check (public.get_current_user_role() in ('mahasiswa', 'dosen', 'teknisi', 'admin'));
create policy "teknisi admin can update reports" on public.reports for update to authenticated using (public.is_teknisi_or_admin()) with check (public.is_teknisi_or_admin());

-- Followups and attachments
create policy "authenticated can read followups" on public.report_followups for select to authenticated using (true);
create policy "teknisi admin can insert followups" on public.report_followups for insert to authenticated with check (public.is_teknisi_or_admin());
create policy "authenticated can read report attachments" on public.report_attachments for select to authenticated using (true);
create policy "allowed roles can insert report attachments" on public.report_attachments for insert to authenticated with check (public.get_current_user_role() in ('mahasiswa', 'dosen', 'teknisi', 'admin'));

-- Checklist
create policy "dosen teknisi admin can read checklist templates" on public.checklist_templates for select to authenticated using (public.get_current_user_role() in ('dosen', 'teknisi', 'admin'));
create policy "dosen teknisi admin can read checklist items" on public.checklist_items for select to authenticated using (public.get_current_user_role() in ('dosen', 'teknisi', 'admin'));
create policy "teknisi kepala lab admin can read checklist results" on public.checklist_results for select to authenticated using (public.get_current_user_role() in ('teknisi', 'kepala_lab', 'admin'));
create policy "teknisi kepala lab admin can read checklist result items" on public.checklist_result_items for select to authenticated using (public.get_current_user_role() in ('teknisi', 'kepala_lab', 'admin'));
create policy "dosen teknisi admin can insert checklist results" on public.checklist_results for insert to authenticated with check (public.get_current_user_role() in ('dosen', 'teknisi', 'admin'));
create policy "dosen teknisi admin can insert checklist result items" on public.checklist_result_items for insert to authenticated with check (public.get_current_user_role() in ('dosen', 'teknisi', 'admin'));

-- Audit logs
create policy "admin can read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());
-- No broad insert policy for audit_logs; inserts should be done by trusted server code or database triggers.
