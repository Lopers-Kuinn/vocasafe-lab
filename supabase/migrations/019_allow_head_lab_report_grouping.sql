-- Allow active kepala_lab users to create grouped report cases in their own laboratory.
-- Operational handling remains limited to teknisi/admin; completion confirmation remains kepala_lab/admin.

begin;

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
  if current_user_id is null or current_role not in ('teknisi', 'kepala_lab', 'admin') then
    raise exception 'Hanya teknisi, kepala laboratorium, atau admin yang dapat membuat kasus.' using errcode = '42501';
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
          or not public.can_manage_laboratory(report.laboratory_id)
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

revoke all on function public.create_report_case(uuid[], text, text) from public, anon;
grant execute on function public.create_report_case(uuid[], text, text) to authenticated;

commit;

