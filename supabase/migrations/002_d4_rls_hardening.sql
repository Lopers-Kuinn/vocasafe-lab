-- VocaSafe Lab D4-13 RLS hardening.
-- Review and run manually after 001_initial_d4_schema.sql.
-- This migration does not create Auth users, delete application data, or make
-- the report-evidence bucket public.

begin;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.user_profiles
  where id = (select auth.uid())
    and is_active = true;
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and is_active = true
  );
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

create or replace function public.is_report_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.get_current_user_role() in ('teknisi', 'kepala_lab', 'admin');
$$;

-- SECURITY DEFINER helpers are callable only by authenticated application
-- users. They return authorization facts for the current auth.uid() only.
revoke all on function public.get_current_user_role() from public;
revoke all on function public.get_current_user_role() from anon;
grant execute on function public.get_current_user_role() to authenticated;

revoke all on function public.is_current_user_active() from public;
revoke all on function public.is_current_user_active() from anon;
grant execute on function public.is_current_user_active() to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_teknisi_or_admin() from public;
revoke all on function public.is_teknisi_or_admin() from anon;
grant execute on function public.is_teknisi_or_admin() to authenticated;

revoke all on function public.is_report_manager() from public;
revoke all on function public.is_report_manager() from anon;
grant execute on function public.is_report_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- User profiles
-- ---------------------------------------------------------------------------

drop policy if exists "users can read own profile" on public.user_profiles;
drop policy if exists "admin can read all profiles" on public.user_profiles;
drop policy if exists "admin can update other profiles" on public.user_profiles;

create policy "users can read own profile"
on public.user_profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "admin can read all profiles"
on public.user_profiles
for select
to authenticated
using ((select public.is_admin()));

create policy "admin can update other profiles"
on public.user_profiles
for update
to authenticated
using (
  (select public.is_admin())
  and id <> (select auth.uid())
)
with check (
  (select public.is_admin())
  and id <> (select auth.uid())
);

-- Restrict browser updates to access-control columns. RLS still decides which
-- rows may be changed. Auth user creation remains outside the browser app.
revoke update on public.user_profiles from authenticated;
grant update (role, is_active, updated_at) on public.user_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Master data: active authenticated read, admin insert/update, no delete policy
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated can read laboratories" on public.laboratories;
drop policy if exists "authenticated can read assets" on public.assets;
drop policy if exists "authenticated can read sops" on public.sops;
drop policy if exists "authenticated can read k3 facilities" on public.k3_facilities;
drop policy if exists "authenticated can read risk points" on public.risk_points;

create policy "active users can read laboratories"
on public.laboratories for select to authenticated
using ((select public.is_current_user_active()));

create policy "active users can read assets"
on public.assets for select to authenticated
using ((select public.is_current_user_active()));

create policy "active users can read sops"
on public.sops for select to authenticated
using ((select public.is_current_user_active()));

create policy "active users can read k3 facilities"
on public.k3_facilities for select to authenticated
using ((select public.is_current_user_active()));

create policy "active users can read risk points"
on public.risk_points for select to authenticated
using ((select public.is_current_user_active()));

drop policy if exists "admin can write laboratories" on public.laboratories;
drop policy if exists "admin can write assets" on public.assets;
drop policy if exists "admin can write sops" on public.sops;
drop policy if exists "admin can write k3 facilities" on public.k3_facilities;
drop policy if exists "admin can write risk points" on public.risk_points;

create policy "admin can insert laboratories"
on public.laboratories for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update laboratories"
on public.laboratories for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin can insert assets"
on public.assets for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update assets"
on public.assets for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin can insert sops"
on public.sops for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update sops"
on public.sops for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin can insert k3 facilities"
on public.k3_facilities for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update k3 facilities"
on public.k3_facilities for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin can insert risk points"
on public.risk_points for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update risk points"
on public.risk_points for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated can read reports" on public.reports;
drop policy if exists "allowed roles can insert reports" on public.reports;
drop policy if exists "teknisi admin can update reports" on public.reports;
drop policy if exists "reporter or managers can read reports" on public.reports;
drop policy if exists "reporter can insert own reports" on public.reports;
drop policy if exists "report managers can update reports" on public.reports;

create policy "reporter or managers can read reports"
on public.reports
for select
to authenticated
using (
  (select public.is_current_user_active())
  and (
    reporter_id = (select auth.uid())
    or (select public.is_report_manager())
  )
);

create policy "reporter can insert own reports"
on public.reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'baru'
  and public.get_current_user_role() in ('mahasiswa', 'dosen', 'teknisi', 'admin')
  and risk_score = severity * probability * exposure
  and risk_category = case
    when risk_score <= 20 then 'rendah'::public.risk_category
    when risk_score <= 50 then 'sedang'::public.risk_category
    when risk_score <= 80 then 'tinggi'::public.risk_category
    else 'kritis'::public.risk_category
  end
);

create policy "report managers can update reports"
on public.reports
for update
to authenticated
using ((select public.is_report_manager()))
with check ((select public.is_report_manager()));

-- Managers update workflow status only; report content and scoring remain
-- immutable from browser update calls after insertion.
revoke update on public.reports from authenticated;
grant update (status, updated_at) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Report follow-ups and attachment metadata
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated can read followups" on public.report_followups;
drop policy if exists "teknisi admin can insert followups" on public.report_followups;
drop policy if exists "report participants can read followups" on public.report_followups;
drop policy if exists "report managers can insert followups" on public.report_followups;

create policy "report participants can read followups"
on public.report_followups
for select
to authenticated
using (
  exists (
    select 1
    from public.reports report
    where report.id = report_followups.report_id
      and (
        report.reporter_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

create policy "report managers can insert followups"
on public.report_followups
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.is_report_manager())
  and exists (
    select 1 from public.reports report
    where report.id = report_followups.report_id
  )
);

drop policy if exists "authenticated can read report attachments" on public.report_attachments;
drop policy if exists "allowed roles can insert report attachments" on public.report_attachments;
drop policy if exists "report participants can read attachment metadata" on public.report_attachments;
drop policy if exists "report participants can insert attachment metadata" on public.report_attachments;

create policy "report participants can read attachment metadata"
on public.report_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.reports report
    where report.id = report_attachments.report_id
      and (
        report.reporter_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

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
  and exists (
    select 1
    from public.reports report
    where report.id = report_attachments.report_id
      and (
        report.reporter_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

-- ---------------------------------------------------------------------------
-- Checklist templates, items, results, and answers
-- ---------------------------------------------------------------------------

drop policy if exists "dosen teknisi admin can read checklist templates" on public.checklist_templates;
drop policy if exists "dosen teknisi admin can read checklist items" on public.checklist_items;
drop policy if exists "admin can write checklist templates" on public.checklist_templates;
drop policy if exists "admin can write checklist items" on public.checklist_items;
drop policy if exists "checklist roles can read templates" on public.checklist_templates;
drop policy if exists "checklist roles can read items" on public.checklist_items;

create policy "checklist roles can read templates"
on public.checklist_templates
for select
to authenticated
using (
  public.get_current_user_role() in ('dosen', 'teknisi', 'kepala_lab', 'admin')
);

create policy "checklist roles can read items"
on public.checklist_items
for select
to authenticated
using (
  public.get_current_user_role() in ('dosen', 'teknisi', 'kepala_lab', 'admin')
);

create policy "admin can insert checklist templates"
on public.checklist_templates for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update checklist templates"
on public.checklist_templates for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin can insert checklist items"
on public.checklist_items for insert to authenticated
with check ((select public.is_admin()));
create policy "admin can update checklist items"
on public.checklist_items for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "teknisi kepala lab admin can read checklist results" on public.checklist_results;
drop policy if exists "teknisi kepala lab admin can read checklist result items" on public.checklist_result_items;
drop policy if exists "dosen teknisi admin can insert checklist results" on public.checklist_results;
drop policy if exists "dosen teknisi admin can insert checklist result items" on public.checklist_result_items;
drop policy if exists "inspectors or managers can read checklist results" on public.checklist_results;
drop policy if exists "inspectors can insert checklist results" on public.checklist_results;
drop policy if exists "checklist participants can read result items" on public.checklist_result_items;
drop policy if exists "checklist participants can insert result items" on public.checklist_result_items;

create policy "inspectors or managers can read checklist results"
on public.checklist_results
for select
to authenticated
using (
  (select public.is_current_user_active())
  and (
    inspector_id = (select auth.uid())
    or (select public.is_report_manager())
  )
);

create policy "inspectors can insert checklist results"
on public.checklist_results
for insert
to authenticated
with check (
  inspector_id = (select auth.uid())
  and public.get_current_user_role() in ('dosen', 'teknisi', 'admin')
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
    or
    (
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
    from public.checklist_templates template
    where template.id = checklist_results.template_id
      and template.is_active = true
  )
);

create policy "checklist participants can read result items"
on public.checklist_result_items
for select
to authenticated
using (
  exists (
    select 1
    from public.checklist_results result
    where result.id = checklist_result_items.result_id
      and (
        result.inspector_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

create policy "checklist participants can insert result items"
on public.checklist_result_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.checklist_results result
    join public.checklist_items item
      on item.id = checklist_result_items.item_id
     and item.template_id = result.template_id
    where result.id = checklist_result_items.result_id
      and result.inspector_id = (select auth.uid())
      and public.get_current_user_role() in ('dosen', 'teknisi', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------

drop policy if exists "admin can read audit logs" on public.audit_logs;
create policy "admin can read audit logs"
on public.audit_logs for select to authenticated
using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Private report evidence bucket
-- Path contract: reports/{reportId}/{fileName}
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated can upload report evidence" on storage.objects;
drop policy if exists "authenticated can read report evidence" on storage.objects;
drop policy if exists "report participants can upload evidence" on storage.objects;
drop policy if exists "report participants can read evidence" on storage.objects;
drop policy if exists "report_evidence_authenticated_upload" on storage.objects;
drop policy if exists "report_evidence_authenticated_read" on storage.objects;

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
    from public.reports report
    where report.id::text = (storage.foldername(name))[2]
      and (
        report.reporter_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

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
    from public.reports report
    where report.id::text = (storage.foldername(name))[2]
      and (
        report.reporter_id = (select auth.uid())
        or (select public.is_report_manager())
      )
  )
);

commit;
