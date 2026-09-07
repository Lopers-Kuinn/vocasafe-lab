-- VocaSafe Lab Phase 3D: allow INSERT ... RETURNING to authorize the new
-- parent row without a self-table lookup through a STABLE helper.

begin;

drop policy if exists "reporter or managers can read reports" on public.reports;

create policy "reporter or managers can read reports"
on public.reports
for select
to authenticated
using (
  (
    reports.reporter_id = (select auth.uid())
    and public.get_current_user_role() is not null
  )
  or public.can_manage_laboratory(reports.laboratory_id)
);

drop policy if exists "inspectors or managers can read checklist results" on public.checklist_results;

create policy "inspectors or managers can read checklist results"
on public.checklist_results
for select
to authenticated
using (
  (
    checklist_results.inspector_id = (select auth.uid())
    and public.get_current_user_role() is not null
  )
  or public.can_manage_laboratory(checklist_results.laboratory_id)
);

commit;
