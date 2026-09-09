-- VocaSafe Lab: immutable reports, verified grouping, and auditable correction requests.
-- Run manually after 016_grouped_report_contributors.sql.

begin;

create table public.report_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null,
  laboratory_id uuid not null references public.laboratories(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 5 and 160),
  grouping_reason text not null check (pg_catalog.char_length(pg_catalog.btrim(grouping_reason)) between 10 and 1000),
  status text not null default 'terverifikasi' check (
    status in ('terverifikasi', 'dalam_penanganan', 'menunggu_konfirmasi', 'selesai', 'dibuka_kembali')
  ),
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  confirmed_by uuid references public.user_profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_case_reports (
  case_id uuid not null references public.report_cases(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete restrict,
  added_by uuid not null references public.user_profiles(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (case_id, report_id),
  unique (report_id)
);

create table public.report_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.report_cases(id) on delete cascade,
  actor_id uuid references public.user_profiles(id) on delete set null,
  event_type text not null check (
    event_type in ('dibuat', 'mulai_ditangani', 'diajukan_konfirmasi', 'dikonfirmasi', 'dikembalikan')
  ),
  note text not null check (pg_catalog.char_length(pg_catalog.btrim(note)) between 5 and 1000),
  created_at timestamptz not null default now()
);

create table public.report_change_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  request_type text not null check (request_type in ('koreksi', 'penarikan')),
  detail text not null check (pg_catalog.char_length(pg_catalog.btrim(detail)) between 10 and 1000),
  status text not null default 'diajukan' check (status in ('diajukan', 'diterima', 'ditolak')),
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  review_note text check (review_note is null or pg_catalog.char_length(pg_catalog.btrim(review_note)) between 5 and 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_report_cases_laboratory_status on public.report_cases(laboratory_id, status);
create index idx_report_cases_asset_id on public.report_cases(asset_id);
create index idx_report_case_reports_case_id on public.report_case_reports(case_id);
create index idx_report_case_events_case_created on public.report_case_events(case_id, created_at);
create index idx_report_change_requests_report_created on public.report_change_requests(report_id, created_at desc);
create unique index idx_report_change_requests_one_pending
  on public.report_change_requests(report_id)
  where status = 'diajukan';

alter table public.report_cases enable row level security;
alter table public.report_case_reports enable row level security;
alter table public.report_case_events enable row level security;
alter table public.report_change_requests enable row level security;

revoke insert, update, delete on public.report_cases from authenticated;
revoke insert, update, delete on public.report_case_reports from authenticated;
revoke insert, update, delete on public.report_case_events from authenticated;
revoke insert, update, delete on public.report_change_requests from authenticated;
grant select on public.report_cases to authenticated;
grant select on public.report_case_reports to authenticated;
grant select on public.report_case_events to authenticated;
grant select on public.report_change_requests to authenticated;

-- Existing reports are safety evidence. Authenticated users have no DELETE grant,
-- and the existing column-level UPDATE grant only permits status/operational fields.
revoke delete on public.reports from authenticated;

create or replace function public.can_read_report_case(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_cases as report_case
    join public.user_profiles as profile on profile.id = (select auth.uid())
    where report_case.id = target_case_id
      and profile.is_active = true
      and (
        profile.role = 'admin'
        or (
          profile.role in ('teknisi', 'kepala_lab')
          and profile.laboratory_id = report_case.laboratory_id
        )
        or exists (
          select 1
          from public.report_case_reports as member
          join public.reports as report on report.id = member.report_id
          where member.case_id = report_case.id
            and report.reporter_id = profile.id
        )
      )
  );
$$;

create or replace function public.can_operate_report_case(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_cases as report_case
    join public.user_profiles as profile on profile.id = (select auth.uid())
    where report_case.id = target_case_id
      and profile.is_active = true
      and (
        profile.role = 'admin'
        or (profile.role = 'teknisi' and profile.laboratory_id = report_case.laboratory_id)
      )
  );
$$;

create or replace function public.can_confirm_report_case(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_cases as report_case
    join public.user_profiles as profile on profile.id = (select auth.uid())
    where report_case.id = target_case_id
      and profile.is_active = true
      and (
        profile.role = 'admin'
        or (profile.role = 'kepala_lab' and profile.laboratory_id = report_case.laboratory_id)
      )
  );
$$;

revoke all on function public.can_read_report_case(uuid) from public, anon;
revoke all on function public.can_operate_report_case(uuid) from public, anon;
revoke all on function public.can_confirm_report_case(uuid) from public, anon;
grant execute on function public.can_read_report_case(uuid) to authenticated;
grant execute on function public.can_operate_report_case(uuid) to authenticated;
grant execute on function public.can_confirm_report_case(uuid) to authenticated;

create policy "participants can read report cases"
on public.report_cases for select to authenticated
using (public.can_read_report_case(report_cases.id));

create policy "participants can read report case members"
on public.report_case_reports for select to authenticated
using (public.can_read_report_case(report_case_reports.case_id));

create policy "participants can read report case events"
on public.report_case_events for select to authenticated
using (public.can_read_report_case(report_case_events.case_id));

create policy "participants can read report change requests"
on public.report_change_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or public.can_manage_report(report_change_requests.report_id)
);

create or replace function public.protect_grouped_report_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and coalesce(pg_catalog.current_setting('vocasafe.case_transition', true), 'off') <> 'on'
    and exists (
      select 1 from public.report_case_reports as member where member.report_id = old.id
    ) then
    raise exception 'Status laporan yang sudah dikelompokkan harus dikelola melalui Kasus Induk.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_grouped_report_status() from public, anon, authenticated;

create trigger trigger_protect_grouped_report_status
before update of status on public.reports
for each row execute function public.protect_grouped_report_status();

create or replace function public.get_report_case_summaries()
returns table (
  id uuid,
  case_number text,
  laboratory_id uuid,
  laboratory_name text,
  asset_id uuid,
  asset_code text,
  asset_name text,
  title text,
  grouping_reason text,
  status text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  member_count bigint,
  reporter_count bigint,
  highest_risk_score integer,
  highest_risk_category public.risk_category,
  member_report_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    report_case.id,
    report_case.case_number,
    report_case.laboratory_id,
    laboratory.name,
    report_case.asset_id,
    asset.code,
    asset.name,
    report_case.title,
    report_case.grouping_reason,
    report_case.status,
    report_case.created_by,
    report_case.created_at,
    report_case.updated_at,
    report_case.confirmed_by,
    report_case.confirmed_at,
    count(member.report_id),
    count(distinct report.reporter_id),
    max(report.risk_score),
    (array_agg(report.risk_category order by report.risk_score desc))[1],
    array_agg(member.report_id order by report.reported_at)
      filter (where public.can_read_report(member.report_id))
  from public.report_cases as report_case
  join public.laboratories as laboratory on laboratory.id = report_case.laboratory_id
  join public.assets as asset on asset.id = report_case.asset_id
  join public.report_case_reports as member on member.case_id = report_case.id
  join public.reports as report on report.id = member.report_id
  where public.can_read_report_case(report_case.id)
  group by report_case.id, laboratory.name, asset.code, asset.name
  order by report_case.updated_at desc;
$$;

create or replace function public.get_report_case_events(target_case_id uuid)
returns table (
  id uuid,
  event_type text,
  note text,
  actor_name text,
  actor_role public.user_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, event.event_type, event.note,
    coalesce(profile.full_name, 'Pengguna tidak tersedia'), profile.role, event.created_at
  from public.report_case_events as event
  left join public.user_profiles as profile on profile.id = event.actor_id
  where event.case_id = target_case_id
    and public.can_read_report_case(target_case_id)
  order by event.created_at;
$$;

revoke all on function public.get_report_case_summaries() from public, anon;
revoke all on function public.get_report_case_events(uuid) from public, anon;
grant execute on function public.get_report_case_summaries() to authenticated;
grant execute on function public.get_report_case_events(uuid) to authenticated;

create or replace function public.create_report_case(
  target_report_ids uuid[],
  case_title text,
  grouping_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.user_role := public.get_current_user_role();
  selected_ids uuid[];
  selected_count integer;
  selected_laboratory_id uuid;
  selected_asset_id uuid;
  created_case_id uuid;
  created_case_number text;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select array_agg(distinct selected_id order by selected_id)
  into selected_ids
  from pg_catalog.unnest(coalesce(target_report_ids, '{}'::uuid[])) as selected_id;

  selected_count := coalesce(pg_catalog.cardinality(selected_ids), 0);
  if current_user_id is null or current_role not in ('teknisi', 'admin') then
    raise exception 'Hanya teknisi atau admin yang dapat membuat kasus.' using errcode = '42501';
  end if;
  if selected_count < 2 or selected_count > 50 then
    raise exception 'Pilih 2 sampai 50 laporan.' using errcode = '22023';
  end if;
  if case_title is null or grouping_reason is null
    or pg_catalog.char_length(pg_catalog.btrim(case_title)) not between 5 and 160
    or pg_catalog.char_length(pg_catalog.btrim(grouping_reason)) not between 10 and 1000 then
    raise exception 'Judul atau alasan pengelompokan belum valid.' using errcode = '22023';
  end if;

  perform 1
  from public.reports as report
  where report.id = any(selected_ids)
  order by report.id
  for update;

  if (select count(*) from public.reports as report where report.id = any(selected_ids)) <> selected_count
    or exists (
      select 1 from public.reports as report
      where report.id = any(selected_ids)
        and (
          report.asset_id is null
          or report.laboratory_id is null
          or report.status in ('selesai', 'ditolak')
          or not public.can_manage_report(report.id)
        )
    ) then
    raise exception 'Laporan pilihan tidak valid atau tidak dapat dikelola.' using errcode = '22023';
  end if;

  select min(report.laboratory_id), min(report.asset_id)
  into selected_laboratory_id, selected_asset_id
  from public.reports as report
  where report.id = any(selected_ids)
  having count(distinct report.laboratory_id) = 1
     and count(distinct report.asset_id) = 1;

  if selected_laboratory_id is null or selected_asset_id is null then
    raise exception 'Semua laporan harus berasal dari aset dan laboratorium yang sama.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.report_case_reports as member where member.report_id = any(selected_ids)
  ) then
    raise exception 'Salah satu laporan sudah terhubung ke kasus lain.' using errcode = '23505';
  end if;

  created_case_number := 'VSL-KASUS-' || pg_catalog.to_char(now_value, 'YYYYMMDD') || '-' ||
    pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.report_cases (
    case_number, laboratory_id, asset_id, title, grouping_reason, created_by
  ) values (
    created_case_number, selected_laboratory_id, selected_asset_id,
    pg_catalog.btrim(case_title), pg_catalog.btrim(grouping_reason), current_user_id
  ) returning id into created_case_id;

  insert into public.report_case_reports (case_id, report_id, added_by)
  select created_case_id, selected_id, current_user_id from pg_catalog.unnest(selected_ids) as selected_id;

  perform pg_catalog.set_config('vocasafe.case_transition', 'on', true);

  update public.reports as report
  set status = case when report.status = 'baru' then 'diverifikasi'::public.report_status else report.status end,
      updated_at = now_value
  where report.id = any(selected_ids);

  insert into public.report_followups (report_id, status, note, created_by)
  select report.id, report.status,
    'Ditautkan ke ' || created_case_number || '. Alasan: ' || pg_catalog.btrim(grouping_reason),
    current_user_id
  from public.reports as report where report.id = any(selected_ids);

  insert into public.report_case_events (case_id, actor_id, event_type, note)
  values (created_case_id, current_user_id, 'dibuat', pg_catalog.btrim(grouping_reason));

  return created_case_id;
end;
$$;

create or replace function public.transition_report_case(
  target_case_id uuid,
  next_status text,
  transition_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  report_case public.report_cases%rowtype;
  event_name text;
  report_status_value public.report_status;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  if current_user_id is null or transition_note is null
    or pg_catalog.char_length(pg_catalog.btrim(transition_note)) not between 5 and 1000 then
    raise exception 'Catatan perubahan wajib berisi 5 sampai 1000 karakter.' using errcode = '22023';
  end if;

  select item.* into report_case
  from public.report_cases as item
  where item.id = target_case_id
  for update;
  if not found then raise exception 'Kasus tidak ditemukan.' using errcode = 'P0002'; end if;

  if next_status = 'dalam_penanganan'
    and report_case.status in ('terverifikasi', 'dibuka_kembali')
    and public.can_operate_report_case(target_case_id) then
    event_name := 'mulai_ditangani';
    report_status_value := 'dalam_penanganan';
  elsif next_status = 'menunggu_konfirmasi'
    and report_case.status = 'dalam_penanganan'
    and public.can_operate_report_case(target_case_id) then
    event_name := 'diajukan_konfirmasi';
    report_status_value := 'dalam_penanganan';
  elsif next_status = 'selesai'
    and report_case.status = 'menunggu_konfirmasi'
    and public.can_confirm_report_case(target_case_id) then
    event_name := 'dikonfirmasi';
    report_status_value := 'selesai';
  elsif next_status = 'dibuka_kembali'
    and report_case.status = 'menunggu_konfirmasi'
    and public.can_confirm_report_case(target_case_id) then
    event_name := 'dikembalikan';
    report_status_value := 'dalam_penanganan';
  else
    raise exception 'Transisi status tidak diizinkan.' using errcode = '42501';
  end if;

  update public.report_cases
  set status = next_status,
      confirmed_by = case when next_status = 'selesai' then current_user_id else null end,
      confirmed_at = case when next_status = 'selesai' then now_value else null end,
      updated_at = now_value
  where id = target_case_id;

  perform pg_catalog.set_config('vocasafe.case_transition', 'on', true);

  update public.reports as report
  set status = report_status_value, updated_at = now_value
  from public.report_case_reports as member
  where member.case_id = target_case_id
    and member.report_id = report.id
    and report.status <> 'ditolak';

  insert into public.report_followups (report_id, status, note, created_by)
  select member.report_id, report.status,
    'Kasus ' || report_case.case_number || ': ' || pg_catalog.btrim(transition_note), current_user_id
  from public.report_case_reports as member
  join public.reports as report on report.id = member.report_id
  where member.case_id = target_case_id;

  insert into public.report_case_events (case_id, actor_id, event_type, note)
  values (target_case_id, current_user_id, event_name, pg_catalog.btrim(transition_note));

  return next_status;
end;
$$;

create or replace function public.submit_report_change_request(
  target_report_id uuid,
  target_request_type text,
  request_detail text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_request_id uuid;
begin
  if current_user_id is null or public.get_current_user_role() is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if target_request_type is null or request_detail is null
    or target_request_type not in ('koreksi', 'penarikan')
    or pg_catalog.char_length(pg_catalog.btrim(request_detail)) not between 10 and 1000 then
    raise exception 'Jenis atau detail permintaan tidak valid.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.reports as report
    where report.id = target_report_id
      and report.reporter_id = current_user_id
      and report.status not in ('selesai', 'ditolak')
  ) then
    raise exception 'Hanya pelapor dapat mengajukan perubahan pada laporan aktifnya.' using errcode = '42501';
  end if;

  insert into public.report_change_requests (report_id, request_type, detail, requested_by)
  values (target_report_id, target_request_type, pg_catalog.btrim(request_detail), current_user_id)
  returning id into created_request_id;
  return created_request_id;
exception
  when unique_violation then
    raise exception 'Masih ada permintaan yang menunggu keputusan.' using errcode = '23505';
end;
$$;

create or replace function public.review_report_change_request(
  target_request_id uuid,
  decision text,
  decision_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.report_change_requests%rowtype;
  next_report_status public.report_status;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  if decision is null or decision_note is null
    or decision not in ('diterima', 'ditolak')
    or pg_catalog.char_length(pg_catalog.btrim(decision_note)) not between 5 and 1000 then
    raise exception 'Keputusan atau catatan tidak valid.' using errcode = '22023';
  end if;

  select item.* into request_record
  from public.report_change_requests as item
  where item.id = target_request_id
  for update;
  if not found or request_record.status <> 'diajukan' then
    raise exception 'Permintaan tidak ditemukan atau sudah diputuskan.' using errcode = '22023';
  end if;
  if current_user_id is null or not public.can_manage_report(request_record.report_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  update public.report_change_requests
  set status = decision, reviewed_by = current_user_id,
      review_note = pg_catalog.btrim(decision_note), reviewed_at = now_value, updated_at = now_value
  where id = target_request_id;

  select report.status into next_report_status
  from public.reports as report where report.id = request_record.report_id;

  if decision = 'diterima' and request_record.request_type = 'penarikan' then
    next_report_status := 'ditolak';
    perform pg_catalog.set_config('vocasafe.case_transition', 'on', true);
    update public.reports set status = next_report_status, updated_at = now_value
    where id = request_record.report_id;
  end if;

  insert into public.report_followups (report_id, status, note, created_by)
  values (
    request_record.report_id,
    next_report_status,
    case when decision = 'diterima' then 'Permintaan diterima: ' else 'Permintaan ditolak: ' end ||
      pg_catalog.btrim(decision_note),
    current_user_id
  );

  return decision;
end;
$$;

revoke all on function public.create_report_case(uuid[], text, text) from public, anon;
revoke all on function public.transition_report_case(uuid, text, text) from public, anon;
revoke all on function public.submit_report_change_request(uuid, text, text) from public, anon;
revoke all on function public.review_report_change_request(uuid, text, text) from public, anon;
grant execute on function public.create_report_case(uuid[], text, text) to authenticated;
grant execute on function public.transition_report_case(uuid, text, text) to authenticated;
grant execute on function public.submit_report_change_request(uuid, text, text) to authenticated;
grant execute on function public.review_report_change_request(uuid, text, text) to authenticated;

comment on table public.report_cases is 'Verified parent cases that group distinct immutable reports about the same asset issue.';
comment on table public.report_change_requests is 'Auditable correction or withdrawal requests; original report evidence is never overwritten.';

commit;
