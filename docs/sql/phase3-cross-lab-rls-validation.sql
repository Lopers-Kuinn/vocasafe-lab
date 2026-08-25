-- Phase 3E: reversible cross-laboratory RLS validation.
-- Run the complete script in Supabase SQL Editor using the database-owner/admin
-- execution context. The fixture and all attempted writes are transaction-local.

begin;

-- ---------------------------------------------------------------------------
-- Deterministic fixture IDs
-- ---------------------------------------------------------------------------
-- LAB-B:              3e000001-0000-4000-8000-000000000001
-- asset-b:            3e000001-0000-4000-8000-000000000002
-- report-b:           3e000001-0000-4000-8000-000000000003
-- follow-up-b:        3e000001-0000-4000-8000-000000000004
-- attachment-b:       3e000001-0000-4000-8000-000000000005
-- template-b:         3e000001-0000-4000-8000-000000000006
-- checklist-item-b:   3e000001-0000-4000-8000-000000000007
-- checklist-result-b: 3e000001-0000-4000-8000-000000000008
-- result-item-b:      3e000001-0000-4000-8000-000000000009
-- denied follow-up:   3e000001-0000-4000-8000-000000000010

do $phase3e_setup$
declare
  v_lab_a_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_manager_id uuid;
  v_admin_id uuid;
  v_lab_a_asset_count bigint;
  v_lab_a_report_count bigint;
begin
  if current_user in ('anon', 'authenticated') then
    raise exception
      'Phase 3E must run from Supabase SQL Editor in a database-owner/admin execution context.';
  end if;

  if not exists (
    select 1
    from public.laboratories
    where id = v_lab_a_id
  ) then
    raise exception 'LAB-A production laboratory % was not found.', v_lab_a_id;
  end if;

  select profile.id
  into v_manager_id
  from public.user_profiles as profile
  where profile.is_active = true
    and profile.laboratory_id = v_lab_a_id
    and profile.role in ('teknisi', 'kepala_lab')
  order by
    case profile.role
      when 'teknisi' then 1
      when 'kepala_lab' then 2
      else 3
    end,
    profile.id
  limit 1;

  if v_manager_id is null then
    raise exception
      'No active teknisi or kepala_lab profile is assigned to LAB-A; cross-lab validation stopped.';
  end if;

  select profile.id
  into v_admin_id
  from public.user_profiles as profile
  where profile.is_active = true
    and profile.role = 'admin'
  order by profile.id
  limit 1;

  select count(*)
  into v_lab_a_asset_count
  from public.assets
  where laboratory_id = v_lab_a_id;

  select count(*)
  into v_lab_a_report_count
  from public.reports
  where laboratory_id = v_lab_a_id;

  perform pg_catalog.set_config(
    'vocasafe.phase3e.manager_user_id',
    v_manager_id::text,
    true
  );
  perform pg_catalog.set_config(
    'vocasafe.phase3e.admin_user_id',
    coalesce(v_admin_id::text, ''),
    true
  );
  perform pg_catalog.set_config(
    'vocasafe.phase3e.lab_a_asset_count',
    v_lab_a_asset_count::text,
    true
  );
  perform pg_catalog.set_config(
    'vocasafe.phase3e.lab_a_report_count',
    v_lab_a_report_count::text,
    true
  );

  if exists (
    select 1 from public.laboratories
    where id = '3e000001-0000-4000-8000-000000000001'
       or code = 'LAB-RLS-TEST-02'
  ) or exists (
    select 1 from public.assets
    where id = '3e000001-0000-4000-8000-000000000002'
       or code = 'ASSET-RLS-TEST-B'
  ) or exists (
    select 1 from public.reports
    where id = '3e000001-0000-4000-8000-000000000003'
       or report_number = 'RPT-RLS-TEST-B'
  ) or exists (
    select 1 from public.report_followups
    where id in (
      '3e000001-0000-4000-8000-000000000004',
      '3e000001-0000-4000-8000-000000000010'
    )
  ) or exists (
    select 1 from public.report_attachments
    where id = '3e000001-0000-4000-8000-000000000005'
       or path = 'reports/3e000001-0000-4000-8000-000000000003/phase3e-evidence.jpg'
  ) or exists (
    select 1 from public.checklist_templates
    where id = '3e000001-0000-4000-8000-000000000006'
  ) or exists (
    select 1 from public.checklist_items
    where id = '3e000001-0000-4000-8000-000000000007'
  ) or exists (
    select 1 from public.checklist_results
    where id = '3e000001-0000-4000-8000-000000000008'
  ) or exists (
    select 1 from public.checklist_result_items
    where id = '3e000001-0000-4000-8000-000000000009'
  ) then
    raise exception
      'A deterministic Phase 3E fixture identifier already exists; no fixture was inserted.';
  end if;

  raise notice 'Selected LAB-A manager profile: %', v_manager_id;
  if v_admin_id is null then
    raise notice 'Admin global assertions will be skipped: no active admin profile exists.';
  else
    raise notice 'Selected active admin profile: %', v_admin_id;
  end if;
end;
$phase3e_setup$;

-- ---------------------------------------------------------------------------
-- Temporary LAB-B fixture, created before switching to the authenticated role
-- ---------------------------------------------------------------------------

insert into public.laboratories (
  id,
  code,
  name,
  department,
  location
) values (
  '3e000001-0000-4000-8000-000000000001',
  'LAB-RLS-TEST-02',
  'Phase 3 Cross-Lab Test Laboratory',
  'Phase 3E validation only',
  'Temporary transaction fixture'
);

insert into public.assets (
  id,
  laboratory_id,
  code,
  name,
  kind,
  category,
  location,
  description,
  status,
  qr_payload
) values (
  '3e000001-0000-4000-8000-000000000002',
  '3e000001-0000-4000-8000-000000000001',
  'ASSET-RLS-TEST-B',
  'Phase 3E Asset B',
  'alat',
  'RLS validation',
  'Temporary LAB-B',
  'Temporary cross-laboratory isolation fixture.',
  'layak',
  'vocasafe://assets/ASSET-RLS-TEST-B'
);

insert into public.reports (
  id,
  report_number,
  asset_id,
  laboratory_id,
  reporter_id,
  title,
  description,
  location,
  status,
  severity,
  probability,
  exposure,
  risk_score,
  risk_category,
  recommendation
) values (
  '3e000001-0000-4000-8000-000000000003',
  'RPT-RLS-TEST-B',
  '3e000001-0000-4000-8000-000000000002',
  '3e000001-0000-4000-8000-000000000001',
  null,
  'Phase 3E Report B',
  'Temporary report used only to validate LAB-A versus LAB-B RLS isolation.',
  'Temporary LAB-B',
  'baru',
  1,
  1,
  1,
  1,
  'rendah',
  'Temporary validation fixture.'
);

insert into public.report_followups (
  id,
  report_id,
  status,
  note,
  created_by
) values (
  '3e000001-0000-4000-8000-000000000004',
  '3e000001-0000-4000-8000-000000000003',
  'baru',
  'Temporary LAB-B follow-up fixture.',
  null
);

-- Metadata only: no storage.objects row or physical Storage object is created.
insert into public.report_attachments (
  id,
  report_id,
  bucket,
  path,
  file_name,
  mime_type,
  size_bytes,
  uploaded_by
) values (
  '3e000001-0000-4000-8000-000000000005',
  '3e000001-0000-4000-8000-000000000003',
  'report-evidence',
  'reports/3e000001-0000-4000-8000-000000000003/phase3e-evidence.jpg',
  'phase3e-evidence.jpg',
  'image/jpeg',
  1,
  null
);

insert into public.checklist_templates (
  id,
  laboratory_id,
  title,
  asset_kind,
  is_active
) values (
  '3e000001-0000-4000-8000-000000000006',
  '3e000001-0000-4000-8000-000000000001',
  'Phase 3E LAB-B Checklist Template',
  'alat',
  true
);

insert into public.checklist_items (
  id,
  template_id,
  label,
  is_critical,
  guidance,
  sort_order
) values (
  '3e000001-0000-4000-8000-000000000007',
  '3e000001-0000-4000-8000-000000000006',
  'Phase 3E fixture condition',
  false,
  'Temporary validation item.',
  1
);

insert into public.checklist_results (
  id,
  template_id,
  asset_id,
  laboratory_id,
  inspector_id,
  overall_note,
  has_risk_finding,
  severity,
  probability,
  exposure,
  risk_score,
  risk_category,
  recommendation
) values (
  '3e000001-0000-4000-8000-000000000008',
  '3e000001-0000-4000-8000-000000000006',
  '3e000001-0000-4000-8000-000000000002',
  '3e000001-0000-4000-8000-000000000001',
  null,
  'Temporary LAB-B checklist result fixture.',
  false,
  null,
  null,
  null,
  null,
  null,
  null
);

insert into public.checklist_result_items (
  id,
  result_id,
  item_id,
  answer,
  note
) values (
  '3e000001-0000-4000-8000-000000000009',
  '3e000001-0000-4000-8000-000000000008',
  '3e000001-0000-4000-8000-000000000007',
  'ya',
  'Temporary LAB-B checklist answer fixture.'
);

-- ---------------------------------------------------------------------------
-- Simulate the selected LAB-A manager as an authenticated JWT subject
-- ---------------------------------------------------------------------------

do $phase3e_manager_claims$
declare
  v_manager_id text := pg_catalog.current_setting(
    'vocasafe.phase3e.manager_user_id'
  );
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', v_manager_id, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object(
      'sub', v_manager_id,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$phase3e_manager_claims$;

set local role authenticated;

do $phase3e_manager_assertions$
declare
  v_lab_a_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_lab_b_id constant uuid := '3e000001-0000-4000-8000-000000000001';
  v_asset_b_id constant uuid := '3e000001-0000-4000-8000-000000000002';
  v_report_b_id constant uuid := '3e000001-0000-4000-8000-000000000003';
  v_followup_b_id constant uuid := '3e000001-0000-4000-8000-000000000004';
  v_attachment_b_id constant uuid := '3e000001-0000-4000-8000-000000000005';
  v_result_b_id constant uuid := '3e000001-0000-4000-8000-000000000008';
  v_result_item_b_id constant uuid := '3e000001-0000-4000-8000-000000000009';
  v_expected_manager_id uuid := pg_catalog.current_setting(
    'vocasafe.phase3e.manager_user_id'
  )::uuid;
  v_expected_assets bigint := pg_catalog.current_setting(
    'vocasafe.phase3e.lab_a_asset_count'
  )::bigint;
  v_expected_reports bigint := pg_catalog.current_setting(
    'vocasafe.phase3e.lab_a_report_count'
  )::bigint;
  v_count bigint;
  v_rows bigint;
begin
  if (select auth.uid()) is distinct from v_expected_manager_id then
    raise exception
      'Authenticated simulation failed: auth.uid() does not match the selected LAB-A manager.';
  end if;

  if public.get_current_user_role() not in ('teknisi', 'kepala_lab') then
    raise exception
      'Authenticated simulation failed: selected profile is not an active LAB-A manager.';
  end if;

  if not pg_catalog.has_column_privilege(
    current_user,
    'public.reports',
    'status',
    'UPDATE'
  ) then
    raise exception 'Authenticated role lacks the expected reports.status UPDATE grant.';
  end if;

  if not pg_catalog.has_table_privilege(
    current_user,
    'public.report_followups',
    'INSERT'
  ) then
    raise exception 'Authenticated role lacks the expected report_followups INSERT grant.';
  end if;

  -- Negative cross-lab SELECT assertions.
  select count(*) into v_count
  from public.reports
  where report_number = 'RPT-RLS-TEST-B';
  if v_count <> 0 then
    raise exception 'Cross-lab report lookup by report_number exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.reports
  where id = v_report_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab report lookup by id exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.report_followups
  where id = v_followup_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab follow-up SELECT exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.report_attachments
  where id = v_attachment_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab attachment metadata exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.checklist_results
  where id = v_result_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab checklist result exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.checklist_result_items
  where id = v_result_item_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab checklist result item exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.assets
  where id = v_asset_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab asset exposed % row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.laboratories
  where id = v_lab_b_id;
  if v_count <> 0 then
    raise exception 'Cross-lab laboratory exposed % row(s).', v_count;
  end if;

  -- UPDATE may be filtered to zero rows or rejected by RLS. Both are a PASS.
  begin
    update public.reports
    set status = 'dalam_penanganan'
    where id = v_report_b_id;

    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'Cross-lab report UPDATE affected % row(s).', v_rows;
    end if;
    raise notice 'PASS: cross-lab report UPDATE affected zero rows.';
  exception
    when insufficient_privilege then
      raise notice 'PASS: cross-lab report UPDATE was rejected by RLS.';
  end;

  -- The insert must be rejected. The P0001 failure below is deliberately not
  -- caught if the INSERT unexpectedly succeeds.
  begin
    insert into public.report_followups (
      id,
      report_id,
      status,
      note,
      created_by
    ) values (
      '3e000001-0000-4000-8000-000000000010',
      v_report_b_id,
      'dalam_penanganan',
      'This cross-lab insert must be denied.',
      (select auth.uid())
    );

    raise exception using
      errcode = 'P0001',
      message = 'Cross-lab follow-up INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege then
      raise notice 'PASS: cross-lab follow-up INSERT was rejected by RLS.';
  end;

  -- Positive same-lab regression assertions use only SELECT against existing
  -- production LAB-A data.
  select count(*) into v_count
  from public.laboratories
  where id = v_lab_a_id;
  if v_count <> 1 then
    raise exception 'LAB-A manager cannot read its own laboratory.';
  end if;

  select count(*) into v_count
  from public.assets
  where laboratory_id = v_lab_a_id;
  if v_count <> v_expected_assets then
    raise exception
      'LAB-A asset visibility mismatch: expected %, observed %.',
      v_expected_assets,
      v_count;
  elsif v_expected_assets = 0 then
    raise notice 'SKIP: LAB-A has no existing asset for positive asset regression.';
  else
    raise notice 'PASS: LAB-A manager can read all % same-lab asset row(s).', v_count;
  end if;

  select count(*) into v_count
  from public.reports
  where laboratory_id = v_lab_a_id;
  if v_count <> v_expected_reports then
    raise exception
      'LAB-A report visibility mismatch: expected %, observed %.',
      v_expected_reports,
      v_count;
  elsif v_expected_reports = 0 then
    raise notice 'SKIP: LAB-A has no existing report for positive report regression.';
  else
    raise notice 'PASS: LAB-A manager can read all % same-lab report row(s).', v_count;
  end if;

  raise notice 'PASS: all LAB-A manager cross-lab isolation assertions succeeded.';
  raise notice 'SKIP: reporter/inspector own-access for LAB-B requires an existing LAB-B user; no production profile is moved or modified by this script.';
end;
$phase3e_manager_assertions$;

-- ---------------------------------------------------------------------------
-- Simulate an active admin when one exists; otherwise record a controlled skip
-- ---------------------------------------------------------------------------

reset role;

do $phase3e_admin_claims$
declare
  v_admin_id text := pg_catalog.current_setting(
    'vocasafe.phase3e.admin_user_id'
  );
  v_subject text;
begin
  v_subject := case
    when v_admin_id = '' then '00000000-0000-0000-0000-000000000000'
    else v_admin_id
  end;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_subject, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object(
      'sub', v_subject,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$phase3e_admin_claims$;

set local role authenticated;

do $phase3e_admin_assertions$
declare
  v_admin_id_text text := pg_catalog.current_setting(
    'vocasafe.phase3e.admin_user_id'
  );
  v_count bigint;
begin
  if v_admin_id_text = '' then
    raise notice 'SKIP: no active admin profile exists for global-access assertions.';
    return;
  end if;

  if (select auth.uid()) is distinct from v_admin_id_text::uuid then
    raise exception
      'Admin simulation failed: auth.uid() does not match the selected admin.';
  end if;

  if public.get_current_user_role() is distinct from 'admin'::public.user_role then
    raise exception 'Admin simulation failed: active admin role was not resolved.';
  end if;

  select count(*) into v_count
  from public.laboratories
  where id in (
    '11111111-1111-1111-1111-111111111111',
    '3e000001-0000-4000-8000-000000000001'
  );
  if v_count <> 2 then
    raise exception 'Admin did not see both LAB-A and temporary LAB-B.';
  end if;

  select count(*) into v_count
  from public.assets
  where id = '3e000001-0000-4000-8000-000000000002';
  if v_count <> 1 then
    raise exception 'Admin did not see temporary LAB-B asset.';
  end if;

  select count(*) into v_count
  from public.reports
  where id = '3e000001-0000-4000-8000-000000000003';
  if v_count <> 1 then
    raise exception 'Admin did not see temporary LAB-B report.';
  end if;

  select count(*) into v_count
  from public.checklist_results
  where id = '3e000001-0000-4000-8000-000000000008';
  if v_count <> 1 then
    raise exception 'Admin did not see temporary LAB-B checklist result.';
  end if;

  raise notice 'PASS: active admin has global access to LAB-A and temporary LAB-B fixtures.';
end;
$phase3e_admin_assertions$;

reset role;

-- Storage limitation: this SQL test validates report_attachments metadata only.
-- Validate upload, download/signed URL, and cross-lab object denial separately
-- through authenticated browser/API sessions backed by real Storage objects.

-- After this script finishes, these read-only checks may be run separately;
-- each count must be zero because the transaction below is rolled back:
-- select count(*) from public.laboratories
-- where id = '3e000001-0000-4000-8000-000000000001';
-- select count(*) from public.reports
-- where id = '3e000001-0000-4000-8000-000000000003';
-- select count(*) from public.checklist_results
-- where id = '3e000001-0000-4000-8000-000000000008';

rollback;
