-- VocaSafe Lab Phase 3B: multi-laboratory authorization and RLS hardening.
-- Review and run manually after 004_ai_endpoint_rate_limit.sql.

begin;

-- ---------------------------------------------------------------------------
-- Laboratory-scoped authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.user_profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active = true;
$$;

revoke all on function public.get_current_user_role() from public;
revoke all on function public.get_current_user_role() from anon;
grant execute on function public.get_current_user_role() to authenticated;

create or replace function public.current_user_laboratory_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.laboratory_id
  from public.user_profiles as profile
  where profile.id = (select auth.uid())
    and profile.is_active = true;
$$;

revoke all on function public.current_user_laboratory_id() from public;
revoke all on function public.current_user_laboratory_id() from anon;
grant execute on function public.current_user_laboratory_id() to authenticated;

create or replace function public.can_access_laboratory(target_laboratory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and target_laboratory_id is not null
      and (
        profile.role = 'admin'
        or (
          profile.laboratory_id is not null
          and profile.laboratory_id = target_laboratory_id
        )
      )
  );
$$;

revoke all on function public.can_access_laboratory(uuid) from public;
revoke all on function public.can_access_laboratory(uuid) from anon;
grant execute on function public.can_access_laboratory(uuid) to authenticated;

create or replace function public.can_manage_laboratory(target_laboratory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and target_laboratory_id is not null
      and (
        profile.role = 'admin'
        or (
          profile.role in ('teknisi', 'kepala_lab')
          and profile.laboratory_id is not null
          and profile.laboratory_id = target_laboratory_id
        )
      )
  );
$$;

revoke all on function public.can_manage_laboratory(uuid) from public;
revoke all on function public.can_manage_laboratory(uuid) from anon;
grant execute on function public.can_manage_laboratory(uuid) to authenticated;

create or replace function public.can_create_in_laboratory(target_laboratory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles as profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and target_laboratory_id is not null
      and (
        profile.role = 'admin'
        or (
          profile.laboratory_id is not null
          and profile.laboratory_id = target_laboratory_id
        )
      )
  );
$$;

revoke all on function public.can_create_in_laboratory(uuid) from public;
revoke all on function public.can_create_in_laboratory(uuid) from anon;
grant execute on function public.can_create_in_laboratory(uuid) to authenticated;

create or replace function public.can_read_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports as report
    where report.id = target_report_id
      and (
        (
          report.reporter_id = (select auth.uid())
          and exists (
            select 1
            from public.user_profiles as profile
            where profile.id = (select auth.uid())
              and profile.is_active = true
          )
        )
        or public.can_manage_laboratory(report.laboratory_id)
      )
  );
$$;

revoke all on function public.can_read_report(uuid) from public;
revoke all on function public.can_read_report(uuid) from anon;
grant execute on function public.can_read_report(uuid) to authenticated;

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
    where report.id = target_report_id
      and public.can_manage_laboratory(report.laboratory_id)
  );
$$;

revoke all on function public.can_manage_report(uuid) from public;
revoke all on function public.can_manage_report(uuid) from anon;
grant execute on function public.can_manage_report(uuid) to authenticated;

create or replace function public.can_read_checklist_result(target_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checklist_results as result
    where result.id = target_result_id
      and (
        (
          result.inspector_id = (select auth.uid())
          and exists (
            select 1
            from public.user_profiles as profile
            where profile.id = (select auth.uid())
              and profile.is_active = true
          )
        )
        or public.can_manage_laboratory(result.laboratory_id)
      )
  );
$$;

revoke all on function public.can_read_checklist_result(uuid) from public;
revoke all on function public.can_read_checklist_result(uuid) from anon;
grant execute on function public.can_read_checklist_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Master data reads: admin global, active non-admin same laboratory only
-- ---------------------------------------------------------------------------

drop policy if exists "active users can read laboratories" on public.laboratories;
create policy "active users can read laboratories"
on public.laboratories for select to authenticated
using (public.can_access_laboratory(laboratories.id));

drop policy if exists "active users can read assets" on public.assets;
create policy "active users can read assets"
on public.assets for select to authenticated
using (public.can_access_laboratory(assets.laboratory_id));

drop policy if exists "active users can read sops" on public.sops;
create policy "active users can read sops"
on public.sops for select to authenticated
using (public.can_access_laboratory(sops.laboratory_id));

drop policy if exists "active users can read k3 facilities" on public.k3_facilities;
create policy "active users can read k3 facilities"
on public.k3_facilities for select to authenticated
using (public.can_access_laboratory(k3_facilities.laboratory_id));

drop policy if exists "active users can read risk points" on public.risk_points;
create policy "active users can read risk points"
on public.risk_points for select to authenticated
using (public.can_access_laboratory(risk_points.laboratory_id));

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

drop policy if exists "reporter or managers can read reports" on public.reports;
create policy "reporter or managers can read reports"
on public.reports
for select
to authenticated
using (public.can_read_report(reports.id));

drop policy if exists "reporter can insert own reports" on public.reports;
create policy "reporter can insert own reports"
on public.reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'baru'
  and public.get_current_user_role() in ('mahasiswa', 'dosen', 'teknisi', 'admin')
  and laboratory_id is not null
  and public.can_create_in_laboratory(laboratory_id)
  and (
    asset_id is null
    or exists (
      select 1
      from public.assets as asset
      where asset.id = reports.asset_id
        and asset.laboratory_id = reports.laboratory_id
    )
  )
  and risk_score = severity * probability * exposure
  and risk_category = case
    when risk_score <= 20 then 'rendah'::public.risk_category
    when risk_score <= 50 then 'sedang'::public.risk_category
    when risk_score <= 80 then 'tinggi'::public.risk_category
    else 'kritis'::public.risk_category
  end
);

drop policy if exists "report managers can update reports" on public.reports;
create policy "report managers can update reports"
on public.reports
for update
to authenticated
using (public.can_manage_report(reports.id))
with check (
  laboratory_id is not null
  and public.can_manage_report(reports.id)
  and public.can_manage_laboratory(laboratory_id)
);

-- ---------------------------------------------------------------------------
-- Report follow-ups and attachment metadata
-- ---------------------------------------------------------------------------

drop policy if exists "report participants can read followups" on public.report_followups;
create policy "report participants can read followups"
on public.report_followups
for select
to authenticated
using (public.can_read_report(report_followups.report_id));

drop policy if exists "report managers can insert followups" on public.report_followups;
create policy "report managers can insert followups"
on public.report_followups
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.can_manage_report(report_followups.report_id)
);

drop policy if exists "report participants can read attachment metadata" on public.report_attachments;
create policy "report participants can read attachment metadata"
on public.report_attachments
for select
to authenticated
using (public.can_read_report(report_attachments.report_id));

drop policy if exists "report participants can insert attachment metadata" on public.report_attachments;
create policy "report participants can insert attachment metadata"
on public.report_attachments
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and bucket = 'report-evidence'
  and (storage.foldername(path))[1] = 'reports'
  and (storage.foldername(path))[2] = report_id::text
  and array_length(storage.foldername(path), 1) = 2
  and lower(storage.extension(path)) in ('jpg', 'jpeg', 'png', 'webp')
  and public.can_read_report(report_attachments.report_id)
);

-- ---------------------------------------------------------------------------
-- Checklist templates, items, results, and answers
-- ---------------------------------------------------------------------------

drop policy if exists "checklist roles can read templates" on public.checklist_templates;
create policy "checklist roles can read templates"
on public.checklist_templates
for select
to authenticated
using (
  public.get_current_user_role() in ('dosen', 'teknisi', 'kepala_lab', 'admin')
  and (
    public.get_current_user_role() = 'admin'
    or checklist_templates.laboratory_id is null
    or public.can_access_laboratory(checklist_templates.laboratory_id)
  )
);

drop policy if exists "checklist roles can read items" on public.checklist_items;
create policy "checklist roles can read items"
on public.checklist_items
for select
to authenticated
using (
  public.get_current_user_role() in ('dosen', 'teknisi', 'kepala_lab', 'admin')
  and exists (
    select 1
    from public.checklist_templates as template
    where template.id = checklist_items.template_id
      and (
        public.get_current_user_role() = 'admin'
        or template.laboratory_id is null
        or public.can_access_laboratory(template.laboratory_id)
      )
  )
);

drop policy if exists "inspectors or managers can read checklist results" on public.checklist_results;
create policy "inspectors or managers can read checklist results"
on public.checklist_results
for select
to authenticated
using (public.can_read_checklist_result(checklist_results.id));

drop policy if exists "inspectors can insert checklist results" on public.checklist_results;
create policy "inspectors can insert checklist results"
on public.checklist_results
for insert
to authenticated
with check (
  inspector_id = (select auth.uid())
  and public.get_current_user_role() in ('dosen', 'teknisi', 'admin')
  and laboratory_id is not null
  and public.can_create_in_laboratory(laboratory_id)
  and (
    asset_id is null
    or exists (
      select 1
      from public.assets as asset
      where asset.id = checklist_results.asset_id
        and asset.laboratory_id = checklist_results.laboratory_id
    )
  )
  and (
    (
      has_risk_finding = false
      and severity is null
      and probability is null
      and exposure is null
      and risk_score is null
      and risk_category is null
      and recommendation is null
    )
    or (
      has_risk_finding = true
      and severity between 1 and 5
      and probability between 1 and 5
      and exposure between 1 and 5
      and risk_score = severity * probability * exposure
      and risk_category = case
        when risk_score <= 20 then 'rendah'::public.risk_category
        when risk_score <= 50 then 'sedang'::public.risk_category
        when risk_score <= 80 then 'tinggi'::public.risk_category
        else 'kritis'::public.risk_category
      end
    )
  )
  and exists (
    select 1
    from public.checklist_templates as template
    where template.id = checklist_results.template_id
      and template.is_active = true
      and (
        template.laboratory_id is null
        or template.laboratory_id = checklist_results.laboratory_id
      )
  )
);

drop policy if exists "checklist participants can read result items" on public.checklist_result_items;
create policy "checklist participants can read result items"
on public.checklist_result_items
for select
to authenticated
using (public.can_read_checklist_result(checklist_result_items.result_id));

drop policy if exists "checklist participants can insert result items" on public.checklist_result_items;
create policy "checklist participants can insert result items"
on public.checklist_result_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.checklist_results as result
    join public.checklist_items as item
      on item.id = checklist_result_items.item_id
     and item.template_id = result.template_id
    where result.id = checklist_result_items.result_id
      and result.inspector_id = (select auth.uid())
      and public.get_current_user_role() in ('dosen', 'teknisi', 'admin')
      and public.can_read_checklist_result(result.id)
  )
);

-- ---------------------------------------------------------------------------
-- Private report evidence bucket: reports/{reportId}/{fileName}
-- ---------------------------------------------------------------------------

drop policy if exists "report participants can upload evidence" on storage.objects;
create policy "report participants can upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = 'reports'
  and array_length(storage.foldername(name), 1) = 2
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.reports as report
    where report.id::text = (storage.foldername(name))[2]
      and public.can_read_report(report.id)
  )
);

drop policy if exists "report participants can read evidence" on storage.objects;
create policy "report participants can read evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-evidence'
  and (storage.foldername(name))[1] = 'reports'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.reports as report
    where report.id::text = (storage.foldername(name))[2]
      and public.can_read_report(report.id)
  )
);

-- All tracked policies that depended on this global role-only helper have now
-- been replaced. An unknown live dependency must abort the migration for
-- manual review instead of being removed implicitly.
drop function if exists public.is_report_manager();

commit;
