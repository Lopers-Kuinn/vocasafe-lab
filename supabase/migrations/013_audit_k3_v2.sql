-- VocaSafe Lab Audit K3 V2: immutable audit snapshots, findings, and sign-off.
-- Review and run manually after migrations 009-012 are active.

begin;

create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  audit_number text unique not null,
  laboratory_id uuid references public.laboratories(id) on delete restrict,
  period_start date,
  period_end date,
  scope text not null,
  criteria text[] not null default '{}',
  methodology text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved')),
  data_complete boolean not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  generated_by uuid not null references public.user_profiles(id) on delete restrict,
  generated_at timestamptz not null default now(),
  reviewed_by uuid references public.user_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  approved_by uuid references public.user_profiles(id) on delete restrict,
  approved_at timestamptz,
  constraint audit_runs_period_check check (
    period_start is null or period_end is null or period_start <= period_end
  ),
  constraint audit_runs_snapshot_object_check check (
    pg_catalog.jsonb_typeof(snapshot) = 'object'
  ),
  constraint audit_runs_review_check check (
    status = 'draft' or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint audit_runs_approval_check check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  )
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  source_type text not null check (
    source_type in ('report', 'checklist', 'asset', 'certificate', 'corrective_action', 'system')
  ),
  source_id uuid,
  asset_id uuid references public.assets(id) on delete set null,
  laboratory_id uuid references public.laboratories(id) on delete restrict,
  classification text not null check (
    classification in ('observation', 'minor', 'major', 'critical')
  ),
  title text not null,
  description text not null,
  recommendation text,
  source_status text,
  owner_snapshot text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_signoffs (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  signoff_type text not null check (signoff_type in ('review', 'approval')),
  signer_id uuid not null references public.user_profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  unique (audit_run_id, signoff_type)
);

create index idx_audit_runs_laboratory_generated
  on public.audit_runs(laboratory_id, generated_at desc);
create index idx_audit_runs_status on public.audit_runs(status);
create index idx_audit_findings_run on public.audit_findings(audit_run_id);
create index idx_audit_findings_classification on public.audit_findings(classification);
create index idx_audit_signoffs_run on public.audit_signoffs(audit_run_id);

alter table public.audit_runs enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_signoffs enable row level security;

revoke insert, update, delete on public.audit_runs from authenticated;
revoke insert, update, delete on public.audit_findings from authenticated;
revoke insert, update, delete on public.audit_signoffs from authenticated;
grant select on public.audit_runs to authenticated;
grant select on public.audit_findings to authenticated;
grant select on public.audit_signoffs to authenticated;

create policy "audit roles can read audit runs"
on public.audit_runs
for select
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    audit_runs.laboratory_id is not null
    and public.can_manage_laboratory(audit_runs.laboratory_id)
  )
);

create policy "audit roles can read audit findings"
on public.audit_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_runs as run
    where run.id = audit_findings.audit_run_id
      and (
        public.get_current_user_role() = 'admin'
        or (
          run.laboratory_id is not null
          and public.can_manage_laboratory(run.laboratory_id)
        )
      )
  )
);

create policy "audit roles can read audit signoffs"
on public.audit_signoffs
for select
to authenticated
using (
  exists (
    select 1
    from public.audit_runs as run
    where run.id = audit_signoffs.audit_run_id
      and (
        public.get_current_user_role() = 'admin'
        or (
          run.laboratory_id is not null
          and public.can_manage_laboratory(run.laboratory_id)
        )
      )
  )
);

create or replace function public.create_audit_snapshot(
  laboratory_scope_id uuid,
  audit_period_start date,
  audit_period_end date,
  audit_scope text,
  audit_criteria text[],
  audit_methodology text,
  snapshot_payload jsonb,
  finding_payload jsonb,
  source_data_complete boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role public.user_role := public.get_current_user_role();
  now_value timestamptz := pg_catalog.clock_timestamp();
  new_run_id uuid;
  generated_number text;
  finding jsonb;
  finding_source_id uuid;
  finding_asset_id uuid;
  finding_laboratory_id uuid;
begin
  if current_role not in ('teknisi', 'kepala_lab', 'admin') then
    raise exception 'Pengguna tidak berwenang membuat snapshot audit.' using errcode = '42501';
  end if;

  if laboratory_scope_id is null and current_role <> 'admin' then
    raise exception 'Audit lintas laboratorium hanya dapat dibuat admin.' using errcode = '42501';
  end if;

  if laboratory_scope_id is not null
    and not public.can_manage_laboratory(laboratory_scope_id) then
    raise exception 'Laboratorium audit tidak dapat diakses.' using errcode = '42501';
  end if;

  if audit_period_start is not null and audit_period_end is not null
    and audit_period_start > audit_period_end then
    raise exception 'Periode audit tidak valid.' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(audit_scope), '') is null
    or nullif(pg_catalog.btrim(audit_methodology), '') is null then
    raise exception 'Ruang lingkup dan metodologi audit wajib diisi.' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(snapshot_payload) is distinct from 'object'
    or pg_catalog.jsonb_typeof(finding_payload) is distinct from 'array' then
    raise exception 'Payload snapshot audit tidak valid.' using errcode = '22023';
  end if;

  generated_number := 'AUD-' || pg_catalog.to_char(now_value, 'YYYYMMDD-HH24MISS')
    || '-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 4));

  insert into public.audit_runs (
    audit_number, laboratory_id, period_start, period_end, scope, criteria,
    methodology, data_complete, snapshot, snapshot_hash, generated_by, generated_at
  ) values (
    generated_number, laboratory_scope_id, audit_period_start, audit_period_end,
    pg_catalog.btrim(audit_scope), coalesce(audit_criteria, '{}'),
    pg_catalog.btrim(audit_methodology), source_data_complete, snapshot_payload,
    pg_catalog.md5(snapshot_payload::text),
    (select auth.uid()), now_value
  ) returning id into new_run_id;

  for finding in select value from pg_catalog.jsonb_array_elements(finding_payload)
  loop
    finding_source_id := case
      when coalesce(finding->>'sourceId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (finding->>'sourceId')::uuid
      else null
    end;
    finding_asset_id := case
      when coalesce(finding->>'assetId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (finding->>'assetId')::uuid
      else null
    end;
    finding_laboratory_id := case
      when coalesce(finding->>'laboratoryId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (finding->>'laboratoryId')::uuid
      else laboratory_scope_id
    end;

    if finding_laboratory_id is not null
      and laboratory_scope_id is not null
      and finding_laboratory_id <> laboratory_scope_id then
      raise exception 'Temuan berada di luar ruang lingkup laboratorium.' using errcode = '42501';
    end if;

    if finding->>'sourceType' <> 'system' and finding_source_id is null then
      raise exception 'ID sumber temuan tidak valid.' using errcode = '22023';
    end if;

    if finding->>'sourceType' = 'report' and not exists (
      select 1 from public.reports as report
      where report.id = finding_source_id
        and (laboratory_scope_id is null or report.laboratory_id = laboratory_scope_id)
        and (finding_laboratory_id is null or report.laboratory_id = finding_laboratory_id)
    ) then
      raise exception 'Sumber laporan tidak berada dalam scope audit.' using errcode = '42501';
    elsif finding->>'sourceType' = 'checklist' and not exists (
      select 1 from public.checklist_results as result
      where result.id = finding_source_id
        and (laboratory_scope_id is null or result.laboratory_id = laboratory_scope_id)
        and (finding_laboratory_id is null or result.laboratory_id = finding_laboratory_id)
    ) then
      raise exception 'Sumber checklist tidak berada dalam scope audit.' using errcode = '42501';
    elsif finding->>'sourceType' = 'asset' and not exists (
      select 1 from public.assets as asset
      where asset.id = finding_source_id
        and (laboratory_scope_id is null or asset.laboratory_id = laboratory_scope_id)
        and (finding_laboratory_id is null or asset.laboratory_id = finding_laboratory_id)
    ) then
      raise exception 'Sumber aset tidak berada dalam scope audit.' using errcode = '42501';
    elsif finding->>'sourceType' = 'certificate' and not exists (
      select 1 from public.asset_certificates as certificate
      where certificate.id = finding_source_id
        and (laboratory_scope_id is null or certificate.laboratory_id = laboratory_scope_id)
        and (finding_laboratory_id is null or certificate.laboratory_id = finding_laboratory_id)
    ) then
      raise exception 'Sumber sertifikat tidak berada dalam scope audit.' using errcode = '42501';
    elsif finding->>'sourceType' = 'corrective_action' and not exists (
      select 1 from public.checklist_corrective_actions as action
      where action.id = finding_source_id
        and (laboratory_scope_id is null or action.laboratory_id = laboratory_scope_id)
        and (finding_laboratory_id is null or action.laboratory_id = finding_laboratory_id)
    ) then
      raise exception 'Sumber tindakan korektif tidak berada dalam scope audit.' using errcode = '42501';
    end if;

    if finding_asset_id is not null and not exists (
      select 1 from public.assets as asset
      where asset.id = finding_asset_id
        and (
          laboratory_scope_id is null
          or asset.laboratory_id = laboratory_scope_id
        )
        and (
          finding_laboratory_id is null
          or asset.laboratory_id = finding_laboratory_id
        )
    ) then
      raise exception 'Aset temuan tidak berada dalam scope audit.' using errcode = '42501';
    end if;

    insert into public.audit_findings (
      audit_run_id, source_type, source_id, asset_id, laboratory_id,
      classification, title, description, recommendation, source_status,
      owner_snapshot, due_at
    ) values (
      new_run_id,
      finding->>'sourceType',
      finding_source_id,
      finding_asset_id,
      finding_laboratory_id,
      finding->>'classification',
      finding->>'title',
      finding->>'description',
      nullif(finding->>'recommendation', ''),
      nullif(finding->>'status', ''),
      nullif(finding->>'owner', ''),
      case
        when nullif(finding->>'dueAt', '') is null then null
        else (finding->>'dueAt')::timestamptz
      end
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, after)
  values (
    (select auth.uid()), 'audit_snapshot_created', 'audit_runs', new_run_id,
    pg_catalog.jsonb_build_object(
      'audit_number', generated_number,
      'laboratory_id', laboratory_scope_id,
      'data_complete', source_data_complete
    )
  );

  return new_run_id;
end;
$$;

revoke all on function public.create_audit_snapshot(uuid, date, date, text, text[], text, jsonb, jsonb, boolean) from public;
revoke all on function public.create_audit_snapshot(uuid, date, date, text, text[], text, jsonb, jsonb, boolean) from anon;
grant execute on function public.create_audit_snapshot(uuid, date, date, text, text[], text, jsonb, jsonb, boolean) to authenticated;

create or replace function public.signoff_audit_run(
  target_audit_run_id uuid,
  signoff_action text,
  signoff_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record public.audit_runs%rowtype;
  current_role public.user_role := public.get_current_user_role();
  now_value timestamptz := pg_catalog.clock_timestamp();
  signoff_id uuid;
begin
  select run.* into run_record
  from public.audit_runs as run
  where run.id = target_audit_run_id
  for update;

  if not found then
    raise exception 'Snapshot audit tidak ditemukan.' using errcode = 'P0002';
  end if;

  if current_role not in ('kepala_lab', 'admin')
    or (run_record.laboratory_id is null and current_role <> 'admin')
    or (run_record.laboratory_id is not null and not public.can_manage_laboratory(run_record.laboratory_id)) then
    raise exception 'Pengguna tidak berwenang menandatangani audit.' using errcode = '42501';
  end if;

  if run_record.generated_by = (select auth.uid()) then
    raise exception 'Pembuat snapshot tidak boleh meninjau atau menyetujui auditnya sendiri.' using errcode = '42501';
  end if;

  if signoff_action = 'review' then
    if run_record.status <> 'draft' then
      raise exception 'Hanya audit draft yang dapat ditinjau.' using errcode = '22023';
    end if;
    update public.audit_runs
    set status = 'reviewed', reviewed_by = (select auth.uid()), reviewed_at = now_value
    where id = target_audit_run_id;
    insert into public.audit_signoffs (audit_run_id, signoff_type, signer_id, note, created_at)
    values (target_audit_run_id, 'review', (select auth.uid()), nullif(pg_catalog.btrim(signoff_note), ''), now_value)
    returning id into signoff_id;
  elsif signoff_action = 'approve' then
    if run_record.status <> 'reviewed' then
      raise exception 'Audit harus ditinjau sebelum disetujui.' using errcode = '22023';
    end if;
    if run_record.reviewed_by = (select auth.uid()) then
      raise exception 'Reviewer tidak boleh menjadi approver untuk audit yang sama.' using errcode = '42501';
    end if;
    update public.audit_runs
    set status = 'approved', approved_by = (select auth.uid()), approved_at = now_value
    where id = target_audit_run_id;
    insert into public.audit_signoffs (audit_run_id, signoff_type, signer_id, note, created_at)
    values (target_audit_run_id, 'approval', (select auth.uid()), nullif(pg_catalog.btrim(signoff_note), ''), now_value)
    returning id into signoff_id;
  else
    raise exception 'Aksi sign-off tidak valid.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, before, after)
  values (
    (select auth.uid()), 'audit_' || signoff_action, 'audit_runs', target_audit_run_id,
    pg_catalog.jsonb_build_object('status', run_record.status),
    pg_catalog.jsonb_build_object('status', case when signoff_action = 'review' then 'reviewed' else 'approved' end)
  );

  return signoff_id;
end;
$$;

revoke all on function public.signoff_audit_run(uuid, text, text) from public;
revoke all on function public.signoff_audit_run(uuid, text, text) from anon;
grant execute on function public.signoff_audit_run(uuid, text, text) to authenticated;

comment on table public.audit_runs is
  'Immutable Audit K3 snapshots. Operational data remains live; each run preserves the reviewed context and metrics.';
comment on table public.audit_findings is
  'Traceable findings copied into an audit run from authorized operational sources.';
comment on table public.audit_signoffs is
  'Review and approval events for an immutable audit snapshot.';

commit;
