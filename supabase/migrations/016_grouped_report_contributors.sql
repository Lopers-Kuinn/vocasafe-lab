-- VocaSafe Lab: expose reporter identity only for reports the current user may read.
-- This supports an asset-grouped report timeline without broadening table RLS.

begin;

create or replace function public.get_report_contributors(target_report_ids uuid[])
returns table (
  report_id uuid,
  full_name text,
  role public.user_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    report.id,
    case
      when report.is_confidential
        and report.reporter_id is distinct from (select auth.uid())
        then 'Identitas dibatasi'
      else coalesce(profile.full_name, 'Pelapor tidak tersedia')
    end,
    profile.role
  from public.reports as report
  left join public.user_profiles as profile on profile.id = report.reporter_id
  where report.id = any(coalesce(target_report_ids, '{}'::uuid[]))
    and pg_catalog.cardinality(coalesce(target_report_ids, '{}'::uuid[])) between 1 and 200
    and public.can_read_report(report.id);
$$;

revoke all on function public.get_report_contributors(uuid[]) from public;
revoke all on function public.get_report_contributors(uuid[]) from anon;
grant execute on function public.get_report_contributors(uuid[]) to authenticated;

create or replace function public.get_asset_open_report_summary(target_asset_id uuid)
returns table (
  asset_id uuid,
  open_report_count bigint,
  open_critical_report_count bigint,
  last_reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    asset.id,
    count(report.id) filter (where report.id is not null),
    count(report.id) filter (where report.risk_category = 'kritis'),
    max(report.reported_at)
  from public.assets as asset
  left join public.reports as report
    on report.asset_id = asset.id
   and report.status not in ('selesai', 'ditolak')
  where asset.id = target_asset_id
    and public.can_access_laboratory(asset.laboratory_id)
  group by asset.id;
$$;

revoke all on function public.get_asset_open_report_summary(uuid) from public;
revoke all on function public.get_asset_open_report_summary(uuid) from anon;
grant execute on function public.get_asset_open_report_summary(uuid) to authenticated;

commit;
