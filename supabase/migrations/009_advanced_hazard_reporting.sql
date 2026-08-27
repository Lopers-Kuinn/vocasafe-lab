-- VocaSafe Lab: richer internal hazard, near-miss, and incident reporting.
-- This migration is additive and keeps legacy reports readable.

begin;

alter table public.reports
  add column report_type text not null default 'kondisi_tidak_aman',
  add column hazard_category text not null default 'lainnya',
  add column occurred_at timestamptz,
  add column activity_at_time text,
  add column hazard_active boolean not null default false,
  add column immediate_action text,
  add column pic_notified boolean not null default false,
  add column people_affected boolean not null default false,
  add column injury_details text,
  add column witness_details text,
  add column is_confidential boolean not null default false;

alter table public.reports
  add constraint reports_report_type_check
  check (
    report_type in (
      'kondisi_tidak_aman',
      'near_miss',
      'kecelakaan_cedera',
      'kerusakan_aset',
      'kebakaran_ledakan',
      'tumpahan_bahan',
      'keluhan_kesehatan'
    )
  ),
  add constraint reports_hazard_category_check
  check (
    hazard_category in (
      'listrik',
      'mekanik',
      'kebakaran',
      'bahan_kimia',
      'ergonomi',
      'fasilitas_k3',
      'lingkungan',
      'lainnya'
    )
  ),
  add constraint reports_activity_at_time_length_check
  check (activity_at_time is null or char_length(activity_at_time) <= 500),
  add constraint reports_immediate_action_length_check
  check (immediate_action is null or char_length(immediate_action) <= 1200),
  add constraint reports_injury_details_length_check
  check (injury_details is null or char_length(injury_details) <= 1200),
  add constraint reports_witness_details_length_check
  check (witness_details is null or char_length(witness_details) <= 500),
  add constraint reports_people_affected_details_check
  check (
    people_affected = false
    or nullif(pg_catalog.btrim(injury_details), '') is not null
  );

create index idx_reports_report_type
  on public.reports(report_type);

create index idx_reports_hazard_category
  on public.reports(hazard_category);

create index idx_reports_occurred_at
  on public.reports(occurred_at desc);

create index idx_reports_hazard_active
  on public.reports(hazard_active)
  where hazard_active = true;

comment on column public.reports.report_type is
  'Internal report classification: unsafe condition, near miss, incident, damage, fire/explosion, spill, or occupational health concern.';
comment on column public.reports.occurred_at is
  'Time the hazard was observed or the incident occurred; distinct from reported_at.';
comment on column public.reports.is_confidential is
  'Reporter requests restricted identity handling. Existing RLS still determines who may read the report.';

commit;
