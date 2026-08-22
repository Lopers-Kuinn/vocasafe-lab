-- Make report follow-up and checklist submission workflows atomic, and align
-- report mutation access with the canonical teknisi/admin rule.

begin;

create or replace function public.can_manage_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports as report
    join public.user_profiles as profile on profile.id = (select auth.uid())
    where report.id = target_report_id
      and profile.is_active = true
      and profile.role in ('teknisi', 'admin')
      and (
        profile.role = 'admin'
        or (
          profile.laboratory_id is not null
          and profile.laboratory_id = report.laboratory_id
        )
      )
  );
$$;

revoke all on function public.can_manage_report(uuid) from public;
revoke all on function public.can_manage_report(uuid) from anon;
grant execute on function public.can_manage_report(uuid) to authenticated;

create or replace function public.save_report_followup_atomic(
  target_report_id uuid,
  next_status public.report_status,
  followup_note text
)
returns table (
  id uuid,
  report_id uuid,
  status public.report_status,
  note text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_followup public.report_followups%rowtype;
begin
  if nullif(btrim(followup_note), '') is null then
    raise exception 'Catatan tindak lanjut wajib diisi.' using errcode = '22023';
  end if;

  if not public.can_manage_report(target_report_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  update public.reports
  set status = next_status, updated_at = now()
  where reports.id = target_report_id;

  if not found then
    raise exception 'Laporan tidak ditemukan.' using errcode = 'P0002';
  end if;

  insert into public.report_followups (report_id, status, note, created_by)
  values (target_report_id, next_status, btrim(followup_note), (select auth.uid()))
  returning * into inserted_followup;

  return query select
    inserted_followup.id,
    inserted_followup.report_id,
    inserted_followup.status,
    inserted_followup.note,
    inserted_followup.created_by,
    inserted_followup.created_at;
end;
$$;

revoke all on function public.save_report_followup_atomic(uuid, public.report_status, text) from public;
revoke all on function public.save_report_followup_atomic(uuid, public.report_status, text) from anon;
grant execute on function public.save_report_followup_atomic(uuid, public.report_status, text) to authenticated;

create or replace function public.submit_checklist_result_atomic(
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
security invoker
set search_path = ''
as $$
declare
  new_result_id uuid;
  expected_count int;
  submitted_count int;
begin
  if public.get_current_user_role() not in ('dosen', 'teknisi', 'admin')
    or not public.can_create_in_laboratory(target_laboratory_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.checklist_templates template
    where template.id = target_template_id
      and template.is_active = true
      and (template.laboratory_id is null or template.laboratory_id = target_laboratory_id)
  ) then
    raise exception 'Template checklist tidak valid.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.assets asset
    where asset.id = target_asset_id and asset.laboratory_id = target_laboratory_id
  ) then
    raise exception 'Aset tidak valid untuk laboratorium ini.' using errcode = '22023';
  end if;

  select count(*) into expected_count
  from public.checklist_items item
  where item.template_id = target_template_id;

  select count(distinct answer.item_id) into submitted_count
  from jsonb_to_recordset(result_answers) as answer(item_id uuid, answer public.checklist_answer, note text)
  join public.checklist_items item
    on item.id = answer.item_id and item.template_id = target_template_id;

  if expected_count = 0 or submitted_count <> expected_count
    or jsonb_array_length(result_answers) <> expected_count then
    raise exception 'Seluruh item checklist aktif harus dijawab tepat satu kali.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(result_answers) as answer(
      item_id uuid,
      answer public.checklist_answer,
      note text
    )
    where answer.answer = 'tidak'
      and nullif(btrim(answer.note), '') is null
  ) then
    raise exception 'Catatan wajib diisi untuk setiap jawaban Tidak.' using errcode = '22023';
  end if;

  if result_has_risk_finding = false and exists (
    select 1
    from jsonb_to_recordset(result_answers) as answer(
      item_id uuid,
      answer public.checklist_answer,
      note text
    )
    where answer.answer = 'tidak'
  ) then
    raise exception 'Temuan risiko wajib dicatat jika ada jawaban Tidak.' using errcode = '22023';
  end if;

  if result_has_risk_finding then
    if result_severity not between 1 and 5
      or result_probability not between 1 and 5
      or result_exposure not between 1 and 5
      or result_risk_score <> result_severity * result_probability * result_exposure
      or result_risk_category <> case
        when result_risk_score <= 20 then 'rendah'::public.risk_category
        when result_risk_score <= 50 then 'sedang'::public.risk_category
        when result_risk_score <= 80 then 'tinggi'::public.risk_category
        else 'kritis'::public.risk_category
      end then
      raise exception 'Data risk scoring tidak valid.' using errcode = '22023';
    end if;
  elsif result_severity is not null or result_probability is not null
    or result_exposure is not null or result_risk_score is not null
    or result_risk_category is not null or result_recommendation is not null then
    raise exception 'Risk scoring harus kosong jika tidak ada temuan risiko.' using errcode = '22023';
  end if;

  insert into public.checklist_results (
    template_id, asset_id, laboratory_id, inspector_id, completed_at,
    overall_note, has_risk_finding, severity, probability, exposure,
    risk_score, risk_category, recommendation, updated_at
  ) values (
    target_template_id, target_asset_id, target_laboratory_id, (select auth.uid()),
    result_completed_at, nullif(btrim(result_overall_note), ''), result_has_risk_finding,
    result_severity, result_probability, result_exposure, result_risk_score,
    result_risk_category, result_recommendation, result_completed_at
  ) returning id into new_result_id;

  insert into public.checklist_result_items (result_id, item_id, answer, note)
  select new_result_id, answer.item_id, answer.answer, nullif(btrim(answer.note), '')
  from jsonb_to_recordset(result_answers) as answer(
    item_id uuid,
    answer public.checklist_answer,
    note text
  );

  return new_result_id;
end;
$$;

revoke all on function public.submit_checklist_result_atomic(
  uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) from public;
revoke all on function public.submit_checklist_result_atomic(
  uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) from anon;
grant execute on function public.submit_checklist_result_atomic(
  uuid, uuid, uuid, timestamptz, text, boolean, int, int, int, int,
  public.risk_category, text, jsonb
) to authenticated;

commit;
