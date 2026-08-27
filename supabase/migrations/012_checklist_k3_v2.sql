begin;

-- Checklist K3 V2: immutable inspection context, evidence, corrective actions,
-- and risk-aware asset review recommendations. Requires migrations 005-010.

alter table public.checklist_templates
  add column if not exists version integer not null default 1,
  add column if not exists effective_from date not null default current_date,
  add column if not exists regulatory_reference text;

alter table public.checklist_items
  add column if not exists evidence_required boolean not null default false,
  add column if not exists measurement_type text,
  add column if not exists measurement_unit text,
  add column if not exists minimum_value numeric,
  add column if not exists maximum_value numeric,
  add column if not exists legal_reference text,
  add column if not exists control_hierarchy text,
  add column if not exists failure_action text;

alter table public.checklist_items
  drop constraint if exists checklist_items_measurement_range_check,
  add constraint checklist_items_measurement_range_check check (
    minimum_value is null or maximum_value is null or minimum_value <= maximum_value
  ),
  drop constraint if exists checklist_items_control_hierarchy_check,
  add constraint checklist_items_control_hierarchy_check check (
    control_hierarchy is null or control_hierarchy in (
      'eliminasi', 'substitusi', 'rekayasa_teknik', 'administratif', 'apd'
    )
  );

alter table public.checklist_results
  add column if not exists started_at timestamptz,
  add column if not exists template_title_snapshot text,
  add column if not exists template_version_snapshot integer,
  add column if not exists inspector_attestation boolean not null default false;

alter table public.checklist_result_items
  add column if not exists item_label_snapshot text,
  add column if not exists is_critical_snapshot boolean,
  add column if not exists measurement_value numeric,
  add column if not exists evidence_bucket text,
  add column if not exists evidence_path text,
  add column if not exists evidence_file_name text,
  add column if not exists evidence_mime_type text,
  add column if not exists evidence_size_bytes integer;

alter table public.checklist_result_items
  drop constraint if exists checklist_result_items_evidence_size_check,
  add constraint checklist_result_items_evidence_size_check check (
    evidence_size_bytes is null or evidence_size_bytes between 1 and 5242880
  ),
  drop constraint if exists checklist_result_items_evidence_consistency_check,
  add constraint checklist_result_items_evidence_consistency_check check (
    (evidence_path is null and evidence_bucket is null)
    or (evidence_path is not null and evidence_bucket = 'checklist-evidence')
  );

-- Existing critical checks require objective evidence on future failed
-- inspections. Existing results are backfilled only with immutable labels.
update public.checklist_items
set evidence_required = true,
    failure_action = coalesce(
      failure_action,
      'Hentikan atau batasi penggunaan aset sampai temuan diperiksa oleh petugas berwenang.'
    )
where is_critical = true;

update public.checklist_results as result
set template_title_snapshot = template.title,
    template_version_snapshot = template.version
from public.checklist_templates as template
where template.id = result.template_id
  and (result.template_title_snapshot is null or result.template_version_snapshot is null);

update public.checklist_result_items as answer
set item_label_snapshot = item.label,
    is_critical_snapshot = item.is_critical
from public.checklist_items as item
where item.id = answer.item_id
  and (answer.item_label_snapshot is null or answer.is_critical_snapshot is null);

create table if not exists public.checklist_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.checklist_results(id) on delete cascade,
  result_item_id uuid references public.checklist_result_items(id) on delete set null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  description text not null,
  control_hierarchy text not null check (control_hierarchy in (
    'eliminasi', 'substitusi', 'rekayasa_teknik', 'administratif', 'apd'
  )),
  assigned_to uuid references public.user_profiles(id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'terbuka' check (
    status in ('terbuka', 'dalam_pengerjaan', 'menunggu_verifikasi', 'selesai', 'dibatalkan')
  ),
  completion_note text,
  completed_at timestamptz,
  verified_by uuid references public.user_profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_corrective_actions_due_check check (due_at >= created_at),
  constraint checklist_corrective_actions_completion_check check (
    status <> 'selesai'
    or (completed_at is not null and verified_by is not null and verified_at is not null)
  )
);

create index if not exists idx_checklist_corrective_actions_result
  on public.checklist_corrective_actions(result_id);
create index if not exists idx_checklist_corrective_actions_due_open
  on public.checklist_corrective_actions(due_at)
  where status not in ('selesai', 'dibatalkan');

alter table public.checklist_corrective_actions enable row level security;
revoke insert, update, delete on public.checklist_corrective_actions from authenticated;
grant select on public.checklist_corrective_actions to authenticated;

drop policy if exists "checklist participants can read corrective actions"
  on public.checklist_corrective_actions;
create policy "checklist participants can read corrective actions"
on public.checklist_corrective_actions
for select
to authenticated
using (public.can_read_checklist_result(checklist_corrective_actions.result_id));

create or replace function public.finalize_checklist_result_v2(
  target_result_id uuid,
  inspection_started_at timestamptz,
  inspector_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_record public.checklist_results%rowtype;
begin
  select result.* into result_record
  from public.checklist_results as result
  where result.id = target_result_id
  for update;

  if not found
    or result_record.inspector_id <> (select auth.uid())
    or public.get_current_user_role() not in ('dosen', 'teknisi', 'admin') then
    raise exception 'Hasil checklist tidak ditemukan atau tidak dapat diperbarui.' using errcode = '42501';
  end if;

  if inspector_confirmed is not true then
    raise exception 'Pernyataan pemeriksa wajib disetujui.' using errcode = '22023';
  end if;

  update public.checklist_results as result
  set started_at = least(coalesce(inspection_started_at, result.completed_at), result.completed_at),
      template_title_snapshot = template.title,
      template_version_snapshot = template.version,
      inspector_attestation = true,
      updated_at = pg_catalog.clock_timestamp()
  from public.checklist_templates as template
  where result.id = target_result_id
    and template.id = result.template_id;

  update public.checklist_result_items as answer
  set item_label_snapshot = item.label,
      is_critical_snapshot = item.is_critical
  from public.checklist_items as item
  where answer.result_id = target_result_id
    and item.id = answer.item_id;

  return target_result_id;
end;
$$;

revoke all on function public.finalize_checklist_result_v2(uuid, timestamptz, boolean) from public;
revoke all on function public.finalize_checklist_result_v2(uuid, timestamptz, boolean) from anon;
grant execute on function public.finalize_checklist_result_v2(uuid, timestamptz, boolean) to authenticated;

create or replace function public.attach_checklist_item_evidence(
  target_result_id uuid,
  target_item_id uuid,
  file_bucket text,
  file_path text,
  file_name text,
  file_mime_type text,
  file_size_bytes integer,
  measured_value numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_owner uuid;
  saved_item_id uuid;
begin
  select result.inspector_id into result_owner
  from public.checklist_results as result
  where result.id = target_result_id;

  if result_owner is distinct from (select auth.uid())
    or public.get_current_user_role() not in ('dosen', 'teknisi', 'admin') then
    raise exception 'Bukti checklist tidak dapat disimpan.' using errcode = '42501';
  end if;

  if file_bucket <> 'checklist-evidence'
    or nullif(pg_catalog.btrim(file_path), '') is null
    or pg_catalog.split_part(file_path, '/', 1) <> target_result_id::text
    or pg_catalog.split_part(file_path, '/', 2) <> (select auth.uid())::text
    or file_size_bytes is null
    or file_size_bytes not between 1 and 5242880
    or file_mime_type is null
    or file_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Metadata bukti checklist tidak valid.' using errcode = '22023';
  end if;

  update public.checklist_result_items as answer
  set evidence_bucket = file_bucket,
      evidence_path = file_path,
      evidence_file_name = nullif(pg_catalog.btrim(file_name), ''),
      evidence_mime_type = file_mime_type,
      evidence_size_bytes = file_size_bytes,
      measurement_value = measured_value
  where answer.result_id = target_result_id
    and answer.item_id = target_item_id
  returning answer.id into saved_item_id;

  if saved_item_id is null then
    raise exception 'Item hasil checklist tidak ditemukan.' using errcode = 'P0002';
  end if;

  return saved_item_id;
end;
$$;

revoke all on function public.attach_checklist_item_evidence(uuid, uuid, text, text, text, text, integer, numeric) from public;
revoke all on function public.attach_checklist_item_evidence(uuid, uuid, text, text, text, text, integer, numeric) from anon;
grant execute on function public.attach_checklist_item_evidence(uuid, uuid, text, text, text, text, integer, numeric) to authenticated;

create or replace function public.save_checklist_corrective_action(
  target_action_id uuid,
  target_result_id uuid,
  target_result_item_id uuid,
  action_description text,
  action_control_hierarchy text,
  action_assigned_to uuid,
  action_due_at timestamptz,
  action_status text,
  action_completion_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_record public.checklist_results%rowtype;
  saved_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select result.* into result_record
  from public.checklist_results as result
  where result.id = target_result_id;

  if not found or not public.can_manage_laboratory(result_record.laboratory_id) then
    raise exception 'Tindakan korektif tidak dapat dikelola.' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(action_description), '') is null
    or action_control_hierarchy not in ('eliminasi', 'substitusi', 'rekayasa_teknik', 'administratif', 'apd')
    or action_assigned_to is null
    or action_due_at is null
    or action_status not in ('terbuka', 'dalam_pengerjaan', 'menunggu_verifikasi', 'selesai', 'dibatalkan')
    or (
      action_status = 'selesai'
      and nullif(pg_catalog.btrim(action_completion_note), '') is null
    ) then
    raise exception 'Data tindakan korektif tidak valid.' using errcode = '22023';
  end if;

  if target_result_item_id is not null and not exists (
    select 1 from public.checklist_result_items as item
    where item.id = target_result_item_id and item.result_id = target_result_id
  ) then
    raise exception 'Item temuan tidak sesuai hasil checklist.' using errcode = '22023';
  end if;

  if action_assigned_to is not null and not exists (
    select 1 from public.user_profiles as profile
    where profile.id = action_assigned_to
      and profile.is_active = true
      and profile.laboratory_id = result_record.laboratory_id
  ) then
    raise exception 'PIC tindakan korektif tidak valid.' using errcode = '22023';
  end if;

  if target_action_id is null then
    insert into public.checklist_corrective_actions (
      result_id, result_item_id, asset_id, laboratory_id, description,
      control_hierarchy, assigned_to, due_at, status, completion_note,
      completed_at, verified_by, verified_at, created_by, updated_at
    ) values (
      target_result_id, target_result_item_id, result_record.asset_id,
      result_record.laboratory_id, pg_catalog.btrim(action_description),
      action_control_hierarchy, action_assigned_to, action_due_at, action_status,
      nullif(pg_catalog.btrim(action_completion_note), ''),
      case when action_status = 'selesai' then now_value else null end,
      case when action_status = 'selesai' then (select auth.uid()) else null end,
      case when action_status = 'selesai' then now_value else null end,
      (select auth.uid()), now_value
    ) returning id into saved_id;
  else
    update public.checklist_corrective_actions as action
    set description = pg_catalog.btrim(action_description),
        control_hierarchy = action_control_hierarchy,
        assigned_to = action_assigned_to,
        due_at = action_due_at,
        status = action_status,
        completion_note = nullif(pg_catalog.btrim(action_completion_note), ''),
        completed_at = case when action_status = 'selesai' then coalesce(action.completed_at, now_value) else null end,
        verified_by = case when action_status = 'selesai' then (select auth.uid()) else null end,
        verified_at = case when action_status = 'selesai' then now_value else null end,
        updated_at = now_value
    where action.id = target_action_id
      and action.result_id = target_result_id
    returning id into saved_id;
  end if;

  if saved_id is null then
    raise exception 'Tindakan korektif tidak ditemukan.' using errcode = 'P0002';
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_checklist_corrective_action(uuid, uuid, uuid, text, text, uuid, timestamptz, text, text) from public;
revoke all on function public.save_checklist_corrective_action(uuid, uuid, uuid, text, text, uuid, timestamptz, text, text) from anon;
grant execute on function public.save_checklist_corrective_action(uuid, uuid, uuid, text, text, uuid, timestamptz, text, text) to authenticated;

create or replace function public.get_checklist_action_assignees(target_result_id uuid)
returns table (id uuid, full_name text, role public.user_role)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.role
  from public.checklist_results as result
  join public.user_profiles as profile
    on profile.is_active = true
   and profile.role in ('dosen', 'teknisi', 'kepala_lab')
   and profile.laboratory_id = result.laboratory_id
  where result.id = target_result_id
    and public.can_manage_laboratory(result.laboratory_id)
  order by profile.full_name;
$$;

revoke all on function public.get_checklist_action_assignees(uuid) from public;
revoke all on function public.get_checklist_action_assignees(uuid) from anon;
grant execute on function public.get_checklist_action_assignees(uuid) to authenticated;

-- Replace the migration-010 synchronizer so explicit risk findings can never
-- recommend a safe asset merely because all binary checklist items passed.
create or replace function public.sync_asset_after_checklist_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inspection record;
  recommended public.asset_status;
begin
  for inspection in
    select
      result.id as result_id,
      result.asset_id,
      result.laboratory_id,
      result.completed_at,
      result.has_risk_finding,
      result.risk_category,
      pg_catalog.bool_or(item.is_critical and answer.answer = 'tidak') as has_critical_failure,
      pg_catalog.bool_or(answer.answer = 'tidak') as has_failure
    from inserted_checklist_items as inserted
    join public.checklist_result_items as answer on answer.id = inserted.id
    join public.checklist_results as result on result.id = answer.result_id
    join public.checklist_items as item on item.id = answer.item_id
    where result.asset_id is not null
    group by result.id, result.asset_id, result.laboratory_id, result.completed_at,
      result.has_risk_finding, result.risk_category
  loop
    recommended := case
      when inspection.has_critical_failure or inspection.risk_category = 'kritis'
        then 'tidak_layak'::public.asset_status
      when inspection.has_failure or inspection.has_risk_finding
        then 'perlu_dicek'::public.asset_status
      else 'layak'::public.asset_status
    end;

    update public.assets
    set last_inspection_at = inspection.completed_at,
        next_inspection_at = inspection.completed_at + (inspection_interval_days * interval '1 day'),
        updated_at = pg_catalog.clock_timestamp()
    where id = inspection.asset_id
      and laboratory_id = inspection.laboratory_id
      and (last_inspection_at is null or inspection.completed_at >= last_inspection_at);

    insert into public.asset_inspection_reviews (
      checklist_result_id, asset_id, laboratory_id, recommended_status
    ) values (
      inspection.result_id, inspection.asset_id, inspection.laboratory_id, recommended
    ) on conflict (checklist_result_id) do update
      set recommended_status = excluded.recommended_status
      where public.asset_inspection_reviews.review_status = 'menunggu';
  end loop;

  return null;
end;
$$;

revoke all on function public.sync_asset_after_checklist_items() from public;
revoke all on function public.sync_asset_after_checklist_items() from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-evidence', 'checklist-evidence', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inspectors can upload checklist evidence" on storage.objects;
create policy "inspectors can upload checklist evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'checklist-evidence'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.checklist_results as result
    where result.id::text = (storage.foldername(name))[1]
      and result.inspector_id = (select auth.uid())
      and public.get_current_user_role() in ('dosen', 'teknisi', 'admin')
  )
);

drop policy if exists "checklist participants can read checklist evidence" on storage.objects;
create policy "checklist participants can read checklist evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'checklist-evidence'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1 from public.checklist_results as result
    where result.id::text = (storage.foldername(name))[1]
      and public.can_read_checklist_result(result.id)
  )
);

commit;
