-- VocaSafe Lab: in-app operational notifications, report acknowledgement,
-- assignment, and response deadlines. Review and run manually after 014.

begin;

alter table public.reports
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists assigned_to uuid references public.user_profiles(id) on delete set null,
  add column if not exists response_due_at timestamptz;

alter table public.reports
  drop constraint if exists reports_acknowledgement_consistency_check,
  add constraint reports_acknowledgement_consistency_check check (
    (acknowledged_at is null and acknowledged_by is null)
    or (acknowledged_at is not null and acknowledged_by is not null)
  ),
  drop constraint if exists reports_response_due_check,
  add constraint reports_response_due_check check (
    response_due_at is null or response_due_at >= coalesce(acknowledged_at, reported_at, created_at)
  );

create index if not exists idx_reports_assigned_open
  on public.reports(assigned_to, response_due_at)
  where status not in ('selesai', 'ditolak');

create index if not exists idx_reports_response_due_open
  on public.reports(response_due_at)
  where response_due_at is not null and status not in ('selesai', 'ditolak');

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  laboratory_id uuid references public.laboratories(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'report_new', 'report_status', 'report_assigned', 'corrective_action'
  )),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 500),
  entity_type text not null check (entity_type in ('report', 'checklist')),
  entity_id uuid not null,
  href text not null check (href like '/%'),
  due_at timestamptz,
  read_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_user_notifications_dedupe
  on public.user_notifications(recipient_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_user_notifications_recipient_unread
  on public.user_notifications(recipient_id, created_at desc)
  where read_at is null;

create index if not exists idx_user_notifications_recipient_due
  on public.user_notifications(recipient_id, due_at)
  where due_at is not null and read_at is null;

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon;
revoke all on public.user_notifications from authenticated;
grant select on public.user_notifications to authenticated;

drop policy if exists "users can read own notifications" on public.user_notifications;
create policy "users can read own notifications"
on public.user_notifications
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  and public.get_current_user_role() is not null
);

create or replace function public.enqueue_user_notification(
  target_recipient_id uuid,
  target_laboratory_id uuid,
  target_notification_type text,
  target_priority text,
  target_title text,
  target_body text,
  target_entity_type text,
  target_entity_id uuid,
  target_href text,
  target_due_at timestamptz,
  target_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if target_recipient_id is null or not exists (
    select 1
    from public.user_profiles as profile
    where profile.id = target_recipient_id
      and profile.is_active = true
  ) then
    return null;
  end if;

  insert into public.user_notifications (
    recipient_id, laboratory_id, notification_type, priority, title, body,
    entity_type, entity_id, href, due_at, dedupe_key
  ) values (
    target_recipient_id,
    target_laboratory_id,
    target_notification_type,
    target_priority,
    pg_catalog.left(pg_catalog.btrim(target_title), 160),
    pg_catalog.left(pg_catalog.btrim(target_body), 500),
    target_entity_type,
    target_entity_id,
    target_href,
    target_due_at,
    target_dedupe_key
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into saved_id;

  return saved_id;
end;
$$;

revoke all on function public.enqueue_user_notification(
  uuid, uuid, text, text, text, text, text, uuid, text, timestamptz, text
) from public;
revoke all on function public.enqueue_user_notification(
  uuid, uuid, text, text, text, text, text, uuid, text, timestamptz, text
) from anon;
revoke all on function public.enqueue_user_notification(
  uuid, uuid, text, text, text, text, text, uuid, text, timestamptz, text
) from authenticated;

create or replace function public.notify_managers_on_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  for target_user_id in
    select profile.id
    from public.user_profiles as profile
    where profile.is_active = true
      and profile.role in ('teknisi', 'kepala_lab', 'admin')
      and (
        profile.role = 'admin'
        or profile.laboratory_id = new.laboratory_id
      )
      and profile.id is distinct from new.reporter_id
  loop
    perform public.enqueue_user_notification(
      target_user_id,
      new.laboratory_id,
      'report_new',
      case when new.risk_category = 'kritis' or new.hazard_active then 'critical' else 'high' end,
      case when new.risk_category = 'kritis' then 'Laporan risiko kritis baru' else 'Laporan bahaya baru' end,
      new.title || ' - ' || coalesce(new.location, 'Lokasi belum dicatat'),
      'report',
      new.id,
      '/reports/' || new.id::text,
      null,
      'report-new:' || new.id::text
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_managers_on_report_insert() from public;
revoke all on function public.notify_managers_on_report_insert() from anon;
revoke all on function public.notify_managers_on_report_insert() from authenticated;

drop trigger if exists trigger_notify_managers_on_report_insert on public.reports;
create trigger trigger_notify_managers_on_report_insert
after insert on public.reports
for each row execute function public.notify_managers_on_report_insert();

create or replace function public.notify_report_participants_on_followup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_record public.reports%rowtype;
begin
  select report.* into report_record
  from public.reports as report
  where report.id = new.report_id;

  if not found then
    return new;
  end if;

  if report_record.reporter_id is not null
    and report_record.reporter_id is distinct from new.created_by then
    perform public.enqueue_user_notification(
      report_record.reporter_id,
      report_record.laboratory_id,
      'report_status',
      case when new.status in ('selesai', 'ditolak') then 'normal' else 'high' end,
      'Status laporan diperbarui',
      report_record.title || ' kini berstatus ' || pg_catalog.replace(new.status::text, '_', ' '),
      'report',
      report_record.id,
      '/reports/' || report_record.id::text,
      report_record.response_due_at,
      'report-followup:' || new.id::text || ':reporter'
    );
  end if;

  if report_record.assigned_to is not null
    and report_record.assigned_to is distinct from new.created_by
    and report_record.assigned_to is distinct from report_record.reporter_id then
    perform public.enqueue_user_notification(
      report_record.assigned_to,
      report_record.laboratory_id,
      'report_status',
      case when report_record.response_due_at is not null
        and report_record.response_due_at < pg_catalog.clock_timestamp()
        and new.status not in ('selesai', 'ditolak') then 'critical'
        else 'high' end,
      'Laporan tugas Anda diperbarui',
      report_record.title || ' kini berstatus ' || pg_catalog.replace(new.status::text, '_', ' '),
      'report',
      report_record.id,
      '/reports/' || report_record.id::text,
      report_record.response_due_at,
      'report-followup:' || new.id::text || ':assignee'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_report_participants_on_followup() from public;
revoke all on function public.notify_report_participants_on_followup() from anon;
revoke all on function public.notify_report_participants_on_followup() from authenticated;

drop trigger if exists trigger_notify_report_participants_on_followup on public.report_followups;
create trigger trigger_notify_report_participants_on_followup
after insert on public.report_followups
for each row execute function public.notify_report_participants_on_followup();

create or replace function public.notify_corrective_action_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  may_read boolean := false;
begin
  if new.assigned_to is null or new.status in ('selesai', 'dibatalkan') then
    return new;
  end if;

  select exists (
    select 1
    from public.user_profiles as profile
    join public.checklist_results as result on result.id = new.result_id
    where profile.id = new.assigned_to
      and profile.is_active = true
      and (
        profile.role in ('teknisi', 'kepala_lab', 'admin')
        or result.inspector_id = profile.id
      )
  ) into may_read;

  if may_read then
    perform public.enqueue_user_notification(
      new.assigned_to,
      new.laboratory_id,
      'corrective_action',
      case when new.due_at < pg_catalog.clock_timestamp() then 'critical' else 'high' end,
      'Tindakan korektif ditugaskan',
      new.description,
      'checklist',
      new.result_id,
      '/checklists/' || new.result_id::text,
      new.due_at,
      'corrective-action:' || new.id::text || ':' || new.updated_at::text
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_corrective_action_assignee() from public;
revoke all on function public.notify_corrective_action_assignee() from anon;
revoke all on function public.notify_corrective_action_assignee() from authenticated;

drop trigger if exists trigger_notify_corrective_action_assignee on public.checklist_corrective_actions;
create trigger trigger_notify_corrective_action_assignee
after insert or update of assigned_to, due_at, status on public.checklist_corrective_actions
for each row execute function public.notify_corrective_action_assignee();

create or replace function public.get_report_response_assignees(target_report_id uuid)
returns table (id uuid, full_name text, role public.user_role)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.role
  from public.reports as report
  join public.user_profiles as profile
    on profile.is_active = true
   and profile.role in ('teknisi', 'admin')
   and (
     profile.role = 'admin'
     or profile.laboratory_id = report.laboratory_id
   )
  where report.id = target_report_id
    and public.get_current_user_role() in ('teknisi', 'admin')
    and public.can_manage_report(report.id)
  order by profile.full_name;
$$;

revoke all on function public.get_report_response_assignees(uuid) from public;
revoke all on function public.get_report_response_assignees(uuid) from anon;
grant execute on function public.get_report_response_assignees(uuid) to authenticated;

create or replace function public.plan_report_response(
  target_report_id uuid,
  target_assignee_id uuid,
  target_due_at timestamptz,
  acknowledgement_note text
)
returns table (
  report_id uuid,
  status public.report_status,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  assigned_to uuid,
  response_due_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  report_record public.reports%rowtype;
  assignee_record public.user_profiles%rowtype;
  next_status public.report_status;
  now_value timestamptz := pg_catalog.clock_timestamp();
  trimmed_note text := nullif(pg_catalog.btrim(acknowledgement_note), '');
begin
  if current_user_id is null
    or public.get_current_user_role() not in ('teknisi', 'admin')
    or not public.can_manage_report(target_report_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  if trimmed_note is null or pg_catalog.char_length(trimmed_note) < 5
    or pg_catalog.char_length(trimmed_note) > 1000 then
    raise exception 'Catatan acknowledgement harus berisi 5 sampai 1000 karakter.' using errcode = '22023';
  end if;

  if target_assignee_id is null or target_due_at is null
    or target_due_at <= now_value
    or target_due_at > now_value + interval '365 days' then
    raise exception 'PIC dan tenggat respons harus valid.' using errcode = '22023';
  end if;

  select report.* into report_record
  from public.reports as report
  where report.id = target_report_id
  for update;

  if not found then
    raise exception 'Laporan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if report_record.status in ('selesai', 'ditolak') then
    raise exception 'Laporan yang sudah ditutup tidak dapat ditugaskan kembali.' using errcode = '22023';
  end if;

  select profile.* into assignee_record
  from public.user_profiles as profile
  where profile.id = target_assignee_id
    and profile.is_active = true
    and profile.role in ('teknisi', 'admin')
    and (
      profile.role = 'admin'
      or profile.laboratory_id = report_record.laboratory_id
    );

  if not found then
    raise exception 'PIC laporan tidak valid untuk laboratorium ini.' using errcode = '22023';
  end if;

  next_status := case
    when report_record.status = 'baru' then 'diverifikasi'::public.report_status
    else report_record.status
  end;

  update public.reports as report
  set status = next_status,
      acknowledged_at = coalesce(report.acknowledged_at, now_value),
      acknowledged_by = coalesce(report.acknowledged_by, current_user_id),
      assigned_to = target_assignee_id,
      response_due_at = target_due_at,
      updated_at = now_value
  where report.id = target_report_id
  returning report.* into report_record;

  insert into public.report_followups (report_id, status, note, created_by)
  values (target_report_id, next_status, trimmed_note, current_user_id);

  if target_assignee_id is distinct from current_user_id then
    perform public.enqueue_user_notification(
      target_assignee_id,
      report_record.laboratory_id,
      'report_assigned',
      case when report_record.risk_category = 'kritis' or report_record.hazard_active then 'critical' else 'high' end,
      'Laporan ditugaskan kepada Anda',
      report_record.title,
      'report',
      report_record.id,
      '/reports/' || report_record.id::text,
      target_due_at,
      'report-assigned:' || report_record.id::text || ':' || target_assignee_id::text || ':' || target_due_at::text
    );
  end if;

  return query select
    report_record.id,
    report_record.status,
    report_record.acknowledged_at,
    report_record.acknowledged_by,
    report_record.assigned_to,
    report_record.response_due_at;
end;
$$;

revoke all on function public.plan_report_response(uuid, uuid, timestamptz, text) from public;
revoke all on function public.plan_report_response(uuid, uuid, timestamptz, text) from anon;
grant execute on function public.plan_report_response(uuid, uuid, timestamptz, text) to authenticated;

create or replace function public.mark_user_notifications_read(target_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if (select auth.uid()) is null or public.get_current_user_role() is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;

  update public.user_notifications as notification
  set read_at = coalesce(notification.read_at, pg_catalog.clock_timestamp())
  where notification.recipient_id = (select auth.uid())
    and notification.read_at is null
    and (target_notification_id is null or notification.id = target_notification_id);

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.mark_user_notifications_read(uuid) from public;
revoke all on function public.mark_user_notifications_read(uuid) from anon;
grant execute on function public.mark_user_notifications_read(uuid) to authenticated;

commit;
