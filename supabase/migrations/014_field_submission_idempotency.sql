-- VocaSafe Lab: idempotent checklist submission for the persistent field outbox.
-- Review and run manually after 013_audit_k3_v2.sql.

begin;

alter table public.checklist_results
  add column if not exists client_submission_id uuid;

create unique index if not exists idx_checklist_results_inspector_submission
  on public.checklist_results(inspector_id, client_submission_id)
  where client_submission_id is not null;

create or replace function public.submit_checklist_result_idempotent(
  submission_id uuid,
  target_template_id uuid,
  target_asset_id uuid,
  target_laboratory_id uuid,
  result_completed_at timestamptz,
  result_overall_note text,
  result_has_risk_finding boolean,
  result_severity int,
  result_probability int,
  result_exposure int,
  result_risk_score int,
  result_risk_category public.risk_category,
  result_recommendation text,
  result_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_result_id uuid;
  saved_result_id uuid;
begin
  if current_user_id is null or submission_id is null then
    raise exception 'Sesi atau ID pengiriman checklist tidak valid.' using errcode = '42501';
  end if;

  if public.get_current_user_role() is null
    or public.get_current_user_role() not in ('dosen', 'teknisi', 'admin') then
    raise exception 'Role pengguna tidak diizinkan mengirim checklist.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || submission_id::text, 0)
  );

  select result.id into existing_result_id
  from public.checklist_results as result
  where result.inspector_id = current_user_id
    and result.client_submission_id = submission_id;

  if existing_result_id is not null then
    return existing_result_id;
  end if;

  saved_result_id := public.submit_checklist_result_atomic(
    target_template_id,
    target_asset_id,
    target_laboratory_id,
    result_completed_at,
    result_overall_note,
    result_has_risk_finding,
    result_severity,
    result_probability,
    result_exposure,
    result_risk_score,
    result_risk_category,
    result_recommendation,
    result_answers
  );

  update public.checklist_results as result
  set client_submission_id = submission_id
  where result.id = saved_result_id
    and result.inspector_id = current_user_id;

  if not found then
    raise exception 'Hasil checklist tidak dapat ditautkan ke ID pengiriman.' using errcode = '42501';
  end if;

  return saved_result_id;
end;
$$;

revoke all on function public.submit_checklist_result_idempotent(
  uuid, uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) from public;
revoke all on function public.submit_checklist_result_idempotent(
  uuid, uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) from anon;
grant execute on function public.submit_checklist_result_idempotent(
  uuid, uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) to authenticated;

commit;
