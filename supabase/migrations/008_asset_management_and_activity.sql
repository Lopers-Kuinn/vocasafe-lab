-- VocaSafe Lab: scoped asset management, PIC metadata, and activity history.
-- Review and run manually after 007_atomic_workflows_and_report_roles.sql.

begin;

alter table public.laboratories
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

alter table public.assets
  add column if not exists pic_user_id uuid
    references public.user_profiles(id) on delete set null;

create index if not exists idx_assets_pic_user_id
  on public.assets(pic_user_id);

create table if not exists public.asset_activity_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  activity_type text not null check (
    activity_type in (
      'aset_dibuat',
      'aset_diperbarui',
      'sop_diperbarui',
      'servis',
      'perbaikan',
      'catatan'
    )
  ),
  title text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_activity_logs_asset_id
  on public.asset_activity_logs(asset_id);
create index if not exists idx_asset_activity_logs_laboratory_id
  on public.asset_activity_logs(laboratory_id);
create index if not exists idx_asset_activity_logs_occurred_at
  on public.asset_activity_logs(occurred_at desc);

alter table public.asset_activity_logs enable row level security;

revoke insert, update, delete on public.asset_activity_logs from authenticated;
grant select on public.asset_activity_logs to authenticated;

create or replace function public.can_manage_asset_data(target_laboratory_id uuid)
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
          profile.role = 'teknisi'
          and profile.laboratory_id = target_laboratory_id
        )
      )
  );
$$;

revoke all on function public.can_manage_asset_data(uuid) from public;
revoke all on function public.can_manage_asset_data(uuid) from anon;
grant execute on function public.can_manage_asset_data(uuid) to authenticated;

drop policy if exists "active users can read asset activity" on public.asset_activity_logs;
create policy "active users can read asset activity"
on public.asset_activity_logs
for select
to authenticated
using (public.can_access_laboratory(asset_activity_logs.laboratory_id));

create or replace function public.list_asset_pic_candidates(
  target_laboratory_id uuid
)
returns table (
  id uuid,
  full_name text,
  role public.user_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  return query
  select profile.id, profile.full_name, profile.role
  from public.user_profiles as profile
  where profile.is_active = true
    and profile.laboratory_id = target_laboratory_id
    and profile.role in ('dosen', 'teknisi', 'kepala_lab')
  order by profile.full_name;
end;
$$;

revoke all on function public.list_asset_pic_candidates(uuid) from public;
revoke all on function public.list_asset_pic_candidates(uuid) from anon;
grant execute on function public.list_asset_pic_candidates(uuid) to authenticated;

create or replace function public.get_asset_contact(target_asset_id uuid)
returns table (
  pic_user_id uuid,
  pic_name text,
  pic_role public.user_role,
  emergency_contact_name text,
  emergency_contact_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assets as asset
    where asset.id = target_asset_id
      and public.can_access_laboratory(asset.laboratory_id)
  ) then
    raise exception 'Aset tidak ditemukan atau tidak dapat diakses.' using errcode = '42501';
  end if;

  return query
  select
    asset.pic_user_id,
    profile.full_name,
    profile.role,
    laboratory.emergency_contact_name,
    laboratory.emergency_contact_phone
  from public.assets as asset
  join public.laboratories as laboratory on laboratory.id = asset.laboratory_id
  left join public.user_profiles as profile
    on profile.id = asset.pic_user_id
   and profile.is_active = true
  where asset.id = target_asset_id;
end;
$$;

revoke all on function public.get_asset_contact(uuid) from public;
revoke all on function public.get_asset_contact(uuid) from anon;
grant execute on function public.get_asset_contact(uuid) to authenticated;

create or replace function public.save_asset_record(
  target_asset_id uuid,
  target_laboratory_id uuid,
  asset_code text,
  asset_name text,
  asset_kind public.asset_kind,
  asset_category text,
  asset_location text,
  asset_description text,
  asset_status public.asset_status,
  asset_pic_user_id uuid,
  asset_next_inspection_at timestamptz,
  update_sop boolean,
  sop_title text,
  sop_version text,
  sop_required_ppe text[],
  sop_steps jsonb,
  update_laboratory_contact boolean,
  laboratory_emergency_contact_name text,
  laboratory_emergency_contact_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_asset public.assets%rowtype;
  existing_sop public.sops%rowtype;
  saved_sop_id uuid;
  normalized_code text := pg_catalog.upper(pg_catalog.btrim(asset_code));
  normalized_name text := pg_catalog.btrim(asset_name);
  sop_reference_count integer;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  if not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  if normalized_code = '' or normalized_name = '' then
    raise exception 'Kode dan nama aset wajib diisi.' using errcode = '22023';
  end if;

  if asset_pic_user_id is not null and not exists (
    select 1
    from public.user_profiles as profile
    where profile.id = asset_pic_user_id
      and profile.is_active = true
      and profile.laboratory_id = target_laboratory_id
      and profile.role in ('dosen', 'teknisi', 'kepala_lab')
  ) then
    raise exception 'PIC harus merupakan pengguna aktif pada laboratorium yang sama.' using errcode = '22023';
  end if;

  if update_laboratory_contact then
    update public.laboratories
    set
      emergency_contact_name = nullif(pg_catalog.btrim(laboratory_emergency_contact_name), ''),
      emergency_contact_phone = nullif(pg_catalog.btrim(laboratory_emergency_contact_phone), ''),
      updated_at = now_value
    where laboratories.id = target_laboratory_id;

    if not found then
      raise exception 'Laboratorium tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  if target_asset_id is null then
    insert into public.assets (
      laboratory_id,
      code,
      name,
      kind,
      category,
      location,
      description,
      status,
      qr_payload,
      pic_user_id,
      next_inspection_at,
      updated_at
    ) values (
      target_laboratory_id,
      normalized_code,
      normalized_name,
      asset_kind,
      nullif(pg_catalog.btrim(asset_category), ''),
      nullif(pg_catalog.btrim(asset_location), ''),
      nullif(pg_catalog.btrim(asset_description), ''),
      asset_status,
      'vocasafe://assets/' || normalized_code,
      asset_pic_user_id,
      asset_next_inspection_at,
      now_value
    )
    returning * into saved_asset;
  else
    select asset.*
    into saved_asset
    from public.assets as asset
    where asset.id = target_asset_id
    for update;

    if not found then
      raise exception 'Aset tidak ditemukan.' using errcode = 'P0002';
    end if;

    if saved_asset.laboratory_id is distinct from target_laboratory_id
      or not public.can_manage_asset_data(saved_asset.laboratory_id) then
      raise exception 'Laboratorium aset tidak boleh diubah.' using errcode = '42501';
    end if;

    update public.assets
    set
      code = normalized_code,
      name = normalized_name,
      kind = asset_kind,
      category = nullif(pg_catalog.btrim(asset_category), ''),
      location = nullif(pg_catalog.btrim(asset_location), ''),
      description = nullif(pg_catalog.btrim(asset_description), ''),
      status = asset_status,
      qr_payload = 'vocasafe://assets/' || normalized_code,
      pic_user_id = asset_pic_user_id,
      next_inspection_at = asset_next_inspection_at,
      updated_at = now_value
    where assets.id = target_asset_id
    returning * into saved_asset;
  end if;

  if update_sop then
    if nullif(pg_catalog.btrim(sop_title), '') is null then
      raise exception 'Judul SOP wajib diisi ketika SOP diperbarui.' using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(sop_steps) is distinct from 'array' then
      raise exception 'Langkah SOP harus berupa daftar.' using errcode = '22023';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(sop_steps) as step(value)
      where pg_catalog.jsonb_typeof(step.value) is distinct from 'string'
    ) then
      raise exception 'Setiap langkah SOP harus berupa teks.' using errcode = '22023';
    end if;

    if saved_asset.sop_id is not null then
      select sop.*
      into existing_sop
      from public.sops as sop
      where sop.id = saved_asset.sop_id
      for update;
    end if;

    select pg_catalog.count(*)
    into sop_reference_count
    from public.assets as asset
    where asset.sop_id = saved_asset.sop_id;

    if saved_asset.sop_id is null
      or existing_sop.id is null
      or existing_sop.laboratory_id is null
      or existing_sop.laboratory_id is distinct from target_laboratory_id
      or sop_reference_count > 1 then
      insert into public.sops (
        laboratory_id,
        title,
        version,
        last_updated_at,
        required_ppe,
        steps,
        updated_at
      ) values (
        target_laboratory_id,
        pg_catalog.btrim(sop_title),
        nullif(pg_catalog.btrim(sop_version), ''),
        now_value,
        coalesce(sop_required_ppe, array[]::text[]),
        sop_steps,
        now_value
      ) returning id into saved_sop_id;

      update public.assets
      set sop_id = saved_sop_id, updated_at = now_value
      where assets.id = saved_asset.id;
    else
      update public.sops
      set
        title = pg_catalog.btrim(sop_title),
        version = nullif(pg_catalog.btrim(sop_version), ''),
        last_updated_at = now_value,
        required_ppe = coalesce(sop_required_ppe, array[]::text[]),
        steps = sop_steps,
        updated_at = now_value
      where sops.id = saved_asset.sop_id;
    end if;

    insert into public.asset_activity_logs (
      asset_id,
      laboratory_id,
      activity_type,
      title,
      note,
      occurred_at,
      created_by
    ) values (
      saved_asset.id,
      target_laboratory_id,
      'sop_diperbarui',
      'SOP digital diperbarui',
      'Perubahan SOP disimpan melalui halaman detail aset.',
      now_value,
      (select auth.uid())
    );
  end if;

  insert into public.asset_activity_logs (
    asset_id,
    laboratory_id,
    activity_type,
    title,
    note,
    occurred_at,
    created_by
  ) values (
    saved_asset.id,
    target_laboratory_id,
    case when target_asset_id is null then 'aset_dibuat' else 'aset_diperbarui' end,
    case when target_asset_id is null then 'Aset ditambahkan' else 'Detail aset diperbarui' end,
    null,
    now_value,
    (select auth.uid())
  );

  return saved_asset.id;
end;
$$;

revoke all on function public.save_asset_record(
  uuid, uuid, text, text, public.asset_kind, text, text, text,
  public.asset_status, uuid, timestamptz, boolean, text, text, text[],
  jsonb, boolean, text, text
) from public;
revoke all on function public.save_asset_record(
  uuid, uuid, text, text, public.asset_kind, text, text, text,
  public.asset_status, uuid, timestamptz, boolean, text, text, text[],
  jsonb, boolean, text, text
) from anon;
grant execute on function public.save_asset_record(
  uuid, uuid, text, text, public.asset_kind, text, text, text,
  public.asset_status, uuid, timestamptz, boolean, text, text, text[],
  jsonb, boolean, text, text
) to authenticated;

create or replace function public.add_asset_activity_log(
  target_asset_id uuid,
  activity_kind text,
  activity_title text,
  activity_note text,
  activity_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_laboratory_id uuid;
  new_log_id uuid;
begin
  select asset.laboratory_id
  into target_laboratory_id
  from public.assets as asset
  where asset.id = target_asset_id;

  if target_laboratory_id is null
    or not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aksi ditolak oleh kebijakan akses database.' using errcode = '42501';
  end if;

  if activity_kind is null
    or activity_kind not in ('servis', 'perbaikan', 'catatan') then
    raise exception 'Jenis aktivitas manual tidak valid.' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(activity_title), '') is null then
    raise exception 'Judul aktivitas wajib diisi.' using errcode = '22023';
  end if;

  insert into public.asset_activity_logs (
    asset_id,
    laboratory_id,
    activity_type,
    title,
    note,
    occurred_at,
    created_by
  ) values (
    target_asset_id,
    target_laboratory_id,
    activity_kind,
    pg_catalog.btrim(activity_title),
    nullif(pg_catalog.btrim(activity_note), ''),
    coalesce(activity_occurred_at, pg_catalog.clock_timestamp()),
    (select auth.uid())
  ) returning id into new_log_id;

  return new_log_id;
end;
$$;

revoke all on function public.add_asset_activity_log(uuid, text, text, text, timestamptz) from public;
revoke all on function public.add_asset_activity_log(uuid, text, text, text, timestamptz) from anon;
grant execute on function public.add_asset_activity_log(uuid, text, text, text, timestamptz) to authenticated;

commit;
