-- VocaSafe Lab: auditable case progress notes and private case-level evidence.
-- Run manually after 017_report_cases_and_immutable_requests.sql.

begin;

alter table public.report_case_events
  drop constraint if exists report_case_events_event_type_check;

alter table public.report_case_events
  add constraint report_case_events_event_type_check check (
    event_type in (
      'dibuat',
      'mulai_ditangani',
      'tindak_lanjut',
      'diajukan_konfirmasi',
      'dikonfirmasi',
      'dikembalikan'
    )
  );

create table public.report_case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.report_cases(id) on delete cascade,
  event_id uuid not null references public.report_case_events(id) on delete cascade,
  evidence_stage text not null check (evidence_stage in ('sebelum', 'proses', 'sesudah')),
  bucket text not null,
  path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_report_case_attachments_case_created
  on public.report_case_attachments(case_id, created_at desc);

alter table public.report_case_attachments enable row level security;
revoke all on public.report_case_attachments from public, anon, authenticated;
grant select, insert on public.report_case_attachments to authenticated;

create policy "case participants can read case evidence"
on public.report_case_attachments
for select
to authenticated
using (public.can_read_report_case(report_case_attachments.case_id));

create policy "case operators can insert case evidence"
on public.report_case_attachments
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and bucket = 'report-evidence'
  and (storage.foldername(path))[1] = 'cases'
  and (storage.foldername(path))[2] = case_id::text
  and array_length(storage.foldername(path), 1) = 2
  and lower(storage.extension(path)) in ('jpg', 'jpeg', 'png', 'webp')
  and public.can_operate_report_case(report_case_attachments.case_id)
  and exists (
    select 1
    from public.report_case_events as event
    where event.id = report_case_attachments.event_id
      and event.case_id = report_case_attachments.case_id
      and event.event_type = 'tindak_lanjut'
  )
);

create policy "case operators can upload case evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = 'cases'
  and array_length(storage.foldername(name), 1) = 2
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.report_cases as report_case
    where report_case.id::text = (storage.foldername(name))[2]
      and public.can_operate_report_case(report_case.id)
  )
);

create policy "case participants can read case evidence objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = 'cases'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.report_cases as report_case
    where report_case.id::text = (storage.foldername(name))[2]
      and public.can_read_report_case(report_case.id)
  )
);

create or replace function public.sync_report_case_status_from_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.report_cases as report_case
  set status = 'dalam_penanganan',
      updated_at = pg_catalog.clock_timestamp()
  where report_case.id = new.case_id
    and report_case.status = 'terverifikasi'
    and exists (
      select 1
      from public.reports as report
      where report.id = new.report_id
        and report.status = 'dalam_penanganan'
    );
  return new;
end;
$$;

revoke all on function public.sync_report_case_status_from_member() from public, anon, authenticated;

create trigger trigger_sync_report_case_status_from_member
after insert on public.report_case_reports
for each row execute function public.sync_report_case_status_from_member();

create or replace function public.require_report_case_completion_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'menunggu_konfirmasi'
    and new.status is distinct from old.status
    and (
      exists (
        select 1
        from public.report_case_reports as member
        join public.reports as report on report.id = member.report_id
        where member.case_id = new.id
          and report.risk_score >= 51
      )
      or exists (
        select 1
        from public.assets as asset
        where asset.id = new.asset_id
          and asset.operational_state in ('dalam_perbaikan', 'dikarantina')
      )
    )
    and not exists (
      select 1
      from public.report_case_attachments as attachment
      where attachment.case_id = new.id
        and attachment.evidence_stage = 'sesudah'
    ) then
    raise exception 'Foto bukti tahap sesudah wajib tersedia sebelum penyelesaian risiko tinggi, kritis, atau aset terisolasi diajukan.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_report_case_completion_evidence() from public, anon, authenticated;

create trigger trigger_require_report_case_completion_evidence
before update of status on public.report_cases
for each row execute function public.require_report_case_completion_evidence();

create or replace function public.add_report_case_followup(
  target_case_id uuid,
  followup_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  report_case public.report_cases%rowtype;
  created_event_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  if current_user_id is null or followup_note is null
    or pg_catalog.char_length(pg_catalog.btrim(followup_note)) not between 5 and 1000 then
    raise exception 'Catatan tindak lanjut wajib berisi 5 sampai 1000 karakter.' using errcode = '22023';
  end if;

  select item.* into report_case
  from public.report_cases as item
  where item.id = target_case_id
  for update;

  if not found then
    raise exception 'Kasus tidak ditemukan.' using errcode = 'P0002';
  end if;
  if report_case.status = 'selesai' then
    raise exception 'Kasus yang sudah selesai tidak dapat menerima tindak lanjut baru.' using errcode = '22023';
  end if;
  if not public.can_operate_report_case(target_case_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  insert into public.report_case_events (case_id, actor_id, event_type, note)
  values (target_case_id, current_user_id, 'tindak_lanjut', pg_catalog.btrim(followup_note))
  returning id into created_event_id;

  update public.report_cases
  set updated_at = now_value
  where id = target_case_id;

  insert into public.report_followups (report_id, status, note, created_by)
  select member.report_id, report.status,
    'Kasus ' || report_case.case_number || ': ' || pg_catalog.btrim(followup_note),
    current_user_id
  from public.report_case_reports as member
  join public.reports as report on report.id = member.report_id
  where member.case_id = target_case_id;

  return created_event_id;
end;
$$;

revoke all on function public.add_report_case_followup(uuid, text) from public, anon;
grant execute on function public.add_report_case_followup(uuid, text) to authenticated;

comment on function public.add_report_case_followup(uuid, text) is
  'Adds an auditable technician or admin progress note to an active report case without changing status.';

comment on table public.report_case_attachments is
  'Private before, progress, and after evidence stored once on a parent report case.';

commit;
