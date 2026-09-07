-- VocaSafe Lab: operational K3 asset register, compliance records, and
-- checklist-to-asset inspection synchronization.
-- Review and run manually after 009_advanced_hazard_reporting.sql.

begin;

-- ---------------------------------------------------------------------------
-- Core asset safety profile
-- ---------------------------------------------------------------------------

alter table public.assets
  add column if not exists manufacturer text,
  add column if not exists model text,
  add column if not exists serial_number text,
  add column if not exists manufacture_year integer,
  add column if not exists acquired_at date,
  add column if not exists technical_specs jsonb not null default '{}'::jsonb,
  add column if not exists energy_sources text[] not null default array[]::text[],
  add column if not exists required_competency text,
  add column if not exists regulatory_reference text,
  add column if not exists inspection_interval_days integer not null default 365,
  add column if not exists operational_state text not null default 'aktif',
  add column if not exists isolation_reason text,
  add column if not exists isolated_at timestamptz,
  add column if not exists isolated_by uuid references public.user_profiles(id) on delete set null;

-- Existing assets marked not fit for use must not be introduced as active.
update public.assets
set operational_state = 'dikarantina',
    isolation_reason = coalesce(
      nullif(pg_catalog.btrim(isolation_reason), ''),
      'Status awal aset tidak layak saat migrasi register K3.'
    ),
    isolated_at = coalesce(isolated_at, pg_catalog.clock_timestamp())
where status = 'tidak_layak'
  and operational_state = 'aktif';

alter table public.assets
  drop constraint if exists assets_manufacture_year_check,
  add constraint assets_manufacture_year_check check (
    manufacture_year is null
    or manufacture_year between 1900 and 2200
  ),
  drop constraint if exists assets_technical_specs_object_check,
  add constraint assets_technical_specs_object_check check (
    pg_catalog.jsonb_typeof(technical_specs) = 'object'
  ),
  drop constraint if exists assets_inspection_interval_days_check,
  add constraint assets_inspection_interval_days_check check (
    inspection_interval_days between 1 and 3650
  ),
  drop constraint if exists assets_operational_state_check,
  add constraint assets_operational_state_check check (
    operational_state in (
      'aktif',
      'penggunaan_dibatasi',
      'dalam_perbaikan',
      'dikarantina',
      'dipensiunkan'
    )
  ),
  drop constraint if exists assets_isolation_metadata_check,
  add constraint assets_isolation_metadata_check check (
    operational_state not in ('dalam_perbaikan', 'dikarantina')
    or (
      nullif(pg_catalog.btrim(isolation_reason), '') is not null
      and isolated_at is not null
    )
  ),
  drop constraint if exists assets_active_condition_check,
  add constraint assets_active_condition_check check (
    operational_state <> 'aktif' or status <> 'tidak_layak'
  );

create index if not exists idx_assets_operational_state
  on public.assets(operational_state);
create index if not exists idx_assets_next_inspection_at
  on public.assets(next_inspection_at);
create unique index if not exists idx_assets_serial_number_not_blank
  on public.assets(pg_catalog.lower(serial_number))
  where nullif(pg_catalog.btrim(serial_number), '') is not null;

-- Keep the existing save_asset_record() RPC compatible. If the legacy edit
-- form marks an asset not fit for use, quarantine is applied before the new
-- active-condition constraint is evaluated.
create or replace function public.enforce_asset_operational_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'tidak_layak'::public.asset_status
    and new.operational_state = 'aktif' then
    new.operational_state := 'dikarantina';
    new.isolation_reason := coalesce(
      nullif(pg_catalog.btrim(new.isolation_reason), ''),
      'Aset otomatis dikarantina karena status kelayakan Tidak Layak.'
    );
    new.isolated_at := coalesce(new.isolated_at, pg_catalog.clock_timestamp());
    new.isolated_by := coalesce(new.isolated_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_asset_operational_safety() from public;
revoke all on function public.enforce_asset_operational_safety() from anon;

drop trigger if exists enforce_asset_operational_safety_trigger on public.assets;
create trigger enforce_asset_operational_safety_trigger
before insert or update of status, operational_state on public.assets
for each row execute function public.enforce_asset_operational_safety();

-- ---------------------------------------------------------------------------
-- Structured safety and compliance records
-- ---------------------------------------------------------------------------

create table public.asset_safety_controls (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  control_type text not null check (
    control_type in (
      'guard',
      'interlock',
      'emergency_stop',
      'grounding',
      'ventilasi',
      'alarm',
      'isolasi_energi',
      'lainnya'
    )
  ),
  name text not null,
  status text not null default 'baik' check (
    status in ('baik', 'perlu_dicek', 'tidak_berfungsi', 'tidak_berlaku')
  ),
  last_verified_at timestamptz,
  note text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_certificates (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  certificate_type text not null check (
    certificate_type in (
      'riksa_uji',
      'kalibrasi',
      'izin_operasi',
      'sertifikat_lainnya'
    )
  ),
  certificate_number text,
  issuer text,
  issued_at date,
  expires_at date,
  bucket text,
  path text,
  file_name text,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  note text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_certificates_date_order_check check (
    issued_at is null or expires_at is null or expires_at >= issued_at
  ),
  constraint asset_certificates_storage_pair_check check (
    (bucket is null and path is null)
    or (bucket is not null and path is not null)
  )
);

create table public.asset_work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text unique not null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  maintenance_type text not null check (
    maintenance_type in ('preventif', 'korektif', 'inspeksi_khusus', 'kalibrasi')
  ),
  status text not null default 'terbuka' check (
    status in ('terbuka', 'dijadwalkan', 'dalam_pengerjaan', 'menunggu_verifikasi', 'selesai', 'dibatalkan')
  ),
  title text not null,
  description text,
  findings text,
  parts_replaced text,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  scheduled_at timestamptz,
  completed_at timestamptz,
  verification_note text,
  verified_by uuid references public.user_profiles(id) on delete set null,
  verified_at timestamptz,
  return_to_service boolean not null default false,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_work_orders_completion_check check (
    status <> 'selesai'
    or (
      completed_at is not null
      and verified_at is not null
      and verified_by is not null
      and nullif(pg_catalog.btrim(verification_note), '') is not null
    )
  ),
  constraint asset_work_orders_return_check check (
    return_to_service = false or status = 'selesai'
  )
);

create table public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  document_type text not null check (
    document_type in ('manual', 'datasheet', 'foto', 'diagram', 'dokumen_lainnya')
  ),
  title text not null,
  bucket text not null,
  path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  note text,
  uploaded_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table public.asset_inspection_reviews (
  id uuid primary key default gen_random_uuid(),
  checklist_result_id uuid not null unique references public.checklist_results(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  laboratory_id uuid not null references public.laboratories(id) on delete cascade,
  recommended_status public.asset_status not null,
  review_status text not null default 'menunggu' check (
    review_status in ('menunggu', 'diterapkan', 'ditolak')
  ),
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint asset_inspection_reviews_decision_check check (
    review_status = 'menunggu'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index idx_asset_safety_controls_asset_id on public.asset_safety_controls(asset_id);
create index idx_asset_certificates_asset_id on public.asset_certificates(asset_id);
create index idx_asset_certificates_expires_at on public.asset_certificates(expires_at);
create index idx_asset_work_orders_asset_id on public.asset_work_orders(asset_id);
create index idx_asset_work_orders_status on public.asset_work_orders(status);
create index idx_asset_documents_asset_id on public.asset_documents(asset_id);
create index idx_asset_inspection_reviews_asset_id on public.asset_inspection_reviews(asset_id);
create index idx_asset_inspection_reviews_pending
  on public.asset_inspection_reviews(review_status)
  where review_status = 'menunggu';

-- Bring legacy asset dates in line with the latest completed checklist without
-- creating retrospective status decisions for old prototype data.
with latest_inspection as (
  select distinct on (result.asset_id)
    result.asset_id,
    result.completed_at
  from public.checklist_results as result
  where result.asset_id is not null
  order by result.asset_id, result.completed_at desc nulls last
)
update public.assets as asset
set
  last_inspection_at = latest.completed_at,
  next_inspection_at = latest.completed_at
    + (asset.inspection_interval_days * interval '1 day'),
  updated_at = pg_catalog.clock_timestamp()
from latest_inspection as latest
where asset.id = latest.asset_id
  and latest.completed_at is not null
  and (
    asset.last_inspection_at is null
    or latest.completed_at >= asset.last_inspection_at
  );

alter table public.asset_safety_controls enable row level security;
alter table public.asset_certificates enable row level security;
alter table public.asset_work_orders enable row level security;
alter table public.asset_documents enable row level security;
alter table public.asset_inspection_reviews enable row level security;

revoke insert, update, delete on public.asset_safety_controls from authenticated;
revoke insert, update, delete on public.asset_certificates from authenticated;
revoke insert, update, delete on public.asset_work_orders from authenticated;
revoke insert, update, delete on public.asset_documents from authenticated;
revoke insert, update, delete on public.asset_inspection_reviews from authenticated;

grant select on public.asset_safety_controls to authenticated;
grant select on public.asset_certificates to authenticated;
grant select on public.asset_work_orders to authenticated;
grant select on public.asset_documents to authenticated;
grant select on public.asset_inspection_reviews to authenticated;

create policy "active users can read asset safety controls"
on public.asset_safety_controls for select to authenticated
using (public.can_access_laboratory(asset_safety_controls.laboratory_id));

create policy "active users can read asset certificates"
on public.asset_certificates for select to authenticated
using (public.can_access_laboratory(asset_certificates.laboratory_id));

create policy "active users can read asset work orders"
on public.asset_work_orders for select to authenticated
using (public.can_access_laboratory(asset_work_orders.laboratory_id));

create policy "active users can read asset documents"
on public.asset_documents for select to authenticated
using (public.can_access_laboratory(asset_documents.laboratory_id));

create policy "active users can read asset inspection reviews"
on public.asset_inspection_reviews for select to authenticated
using (public.can_access_laboratory(asset_inspection_reviews.laboratory_id));

-- ---------------------------------------------------------------------------
-- Controlled writes through audited RPCs
-- ---------------------------------------------------------------------------

create or replace function public.save_asset_safety_profile(
  target_asset_id uuid,
  asset_manufacturer text,
  asset_model text,
  asset_serial_number text,
  asset_manufacture_year integer,
  asset_acquired_at date,
  asset_technical_specs jsonb,
  asset_energy_sources text[],
  asset_required_competency text,
  asset_regulatory_reference text,
  asset_inspection_interval_days integer,
  asset_operational_state text,
  asset_isolation_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_asset public.assets%rowtype;
  now_value timestamptz := pg_catalog.clock_timestamp();
  normalized_state text := pg_catalog.btrim(asset_operational_state);
begin
  select asset.* into current_asset
  from public.assets as asset
  where asset.id = target_asset_id
  for update;

  if not found or not public.can_manage_asset_data(current_asset.laboratory_id) then
    raise exception 'Aset tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if asset_technical_specs is null
    or pg_catalog.jsonb_typeof(asset_technical_specs) <> 'object' then
    raise exception 'Spesifikasi teknis harus berupa object JSON.' using errcode = '22023';
  end if;

  if asset_inspection_interval_days not between 1 and 3650 then
    raise exception 'Interval inspeksi harus antara 1 dan 3650 hari.' using errcode = '22023';
  end if;

  if normalized_state not in (
    'aktif', 'penggunaan_dibatasi', 'dalam_perbaikan', 'dikarantina', 'dipensiunkan'
  ) then
    raise exception 'Status operasional tidak valid.' using errcode = '22023';
  end if;

  if normalized_state = 'aktif' and current_asset.status = 'tidak_layak' then
    raise exception 'Aset tidak layak tidak dapat diaktifkan.' using errcode = '22023';
  end if;

  if normalized_state in ('dalam_perbaikan', 'dikarantina')
    and nullif(pg_catalog.btrim(asset_isolation_reason), '') is null then
    raise exception 'Alasan isolasi wajib diisi.' using errcode = '22023';
  end if;

  update public.assets
  set
    manufacturer = nullif(pg_catalog.btrim(asset_manufacturer), ''),
    model = nullif(pg_catalog.btrim(asset_model), ''),
    serial_number = nullif(pg_catalog.btrim(asset_serial_number), ''),
    manufacture_year = asset_manufacture_year,
    acquired_at = asset_acquired_at,
    technical_specs = asset_technical_specs,
    energy_sources = coalesce(asset_energy_sources, array[]::text[]),
    required_competency = nullif(pg_catalog.btrim(asset_required_competency), ''),
    regulatory_reference = nullif(pg_catalog.btrim(asset_regulatory_reference), ''),
    inspection_interval_days = asset_inspection_interval_days,
    operational_state = normalized_state,
    isolation_reason = case
      when normalized_state in ('dalam_perbaikan', 'dikarantina')
        then pg_catalog.btrim(asset_isolation_reason)
      else null
    end,
    isolated_at = case
      when normalized_state in ('dalam_perbaikan', 'dikarantina')
        then coalesce(current_asset.isolated_at, now_value)
      else null
    end,
    isolated_by = case
      when normalized_state in ('dalam_perbaikan', 'dikarantina')
        then coalesce(current_asset.isolated_by, (select auth.uid()))
      else null
    end,
    updated_at = now_value
  where id = target_asset_id;

  if current_asset.operational_state is distinct from normalized_state then
    insert into public.asset_activity_logs (
      asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
    ) values (
      target_asset_id,
      current_asset.laboratory_id,
      'status_operasional',
      'Status operasional diubah',
      'Dari ' || current_asset.operational_state || ' menjadi ' || normalized_state
        || case
          when nullif(pg_catalog.btrim(asset_isolation_reason), '') is not null
            then '. Alasan: ' || pg_catalog.btrim(asset_isolation_reason)
          else ''
        end,
      now_value,
      (select auth.uid())
    );
  end if;

  return target_asset_id;
end;
$$;

revoke all on function public.save_asset_safety_profile(
  uuid, text, text, text, integer, date, jsonb, text[], text, text, integer, text, text
) from public;
revoke all on function public.save_asset_safety_profile(
  uuid, text, text, text, integer, date, jsonb, text[], text, text, integer, text, text
) from anon;
grant execute on function public.save_asset_safety_profile(
  uuid, text, text, text, integer, date, jsonb, text[], text, text, integer, text, text
) to authenticated;

create or replace function public.save_asset_safety_control(
  target_control_id uuid,
  target_asset_id uuid,
  control_kind text,
  control_name text,
  control_status text,
  control_last_verified_at timestamptz,
  control_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_laboratory_id uuid;
  saved_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select asset.laboratory_id into target_laboratory_id
  from public.assets as asset where asset.id = target_asset_id;

  if target_laboratory_id is null or not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aset tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if control_kind not in (
    'guard', 'interlock', 'emergency_stop', 'grounding', 'ventilasi',
    'alarm', 'isolasi_energi', 'lainnya'
  ) or control_status not in ('baik', 'perlu_dicek', 'tidak_berfungsi', 'tidak_berlaku') then
    raise exception 'Data kontrol keselamatan tidak valid.' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(control_name), '') is null then
    raise exception 'Nama kontrol keselamatan wajib diisi.' using errcode = '22023';
  end if;

  if target_control_id is null then
    insert into public.asset_safety_controls (
      asset_id, laboratory_id, control_type, name, status, last_verified_at,
      note, created_by, updated_at
    ) values (
      target_asset_id, target_laboratory_id, control_kind,
      pg_catalog.btrim(control_name), control_status, control_last_verified_at,
      nullif(pg_catalog.btrim(control_note), ''), (select auth.uid()), now_value
    ) returning id into saved_id;
  else
    update public.asset_safety_controls
    set
      control_type = control_kind,
      name = pg_catalog.btrim(control_name),
      status = control_status,
      last_verified_at = control_last_verified_at,
      note = nullif(pg_catalog.btrim(control_note), ''),
      updated_at = now_value
    where id = target_control_id
      and asset_id = target_asset_id
      and laboratory_id = target_laboratory_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Kontrol keselamatan tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.asset_activity_logs (
    asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
  ) values (
    target_asset_id, target_laboratory_id, 'kontrol_keselamatan',
    'Kontrol keselamatan diperbarui', pg_catalog.btrim(control_name),
    now_value, (select auth.uid())
  );

  return saved_id;
end;
$$;

revoke all on function public.save_asset_safety_control(uuid, uuid, text, text, text, timestamptz, text) from public;
revoke all on function public.save_asset_safety_control(uuid, uuid, text, text, text, timestamptz, text) from anon;
grant execute on function public.save_asset_safety_control(uuid, uuid, text, text, text, timestamptz, text) to authenticated;

create or replace function public.save_asset_certificate(
  target_certificate_id uuid,
  target_asset_id uuid,
  certificate_kind text,
  certificate_number_value text,
  certificate_issuer text,
  certificate_issued_at date,
  certificate_expires_at date,
  document_bucket text,
  document_path text,
  document_file_name text,
  document_mime_type text,
  document_size_bytes integer,
  certificate_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_laboratory_id uuid;
  saved_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select asset.laboratory_id into target_laboratory_id
  from public.assets as asset where asset.id = target_asset_id;

  if target_laboratory_id is null or not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aset tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if certificate_kind not in ('riksa_uji', 'kalibrasi', 'izin_operasi', 'sertifikat_lainnya') then
    raise exception 'Jenis sertifikat tidak valid.' using errcode = '22023';
  end if;

  if certificate_issued_at is not null and certificate_expires_at is not null
    and certificate_expires_at < certificate_issued_at then
    raise exception 'Tanggal kedaluwarsa tidak boleh sebelum tanggal terbit.' using errcode = '22023';
  end if;

  if (document_bucket is null) <> (document_path is null) then
    raise exception 'Metadata penyimpanan dokumen tidak lengkap.' using errcode = '22023';
  end if;

  if target_certificate_id is null then
    insert into public.asset_certificates (
      asset_id, laboratory_id, certificate_type, certificate_number, issuer,
      issued_at, expires_at, bucket, path, file_name, mime_type, size_bytes,
      note, created_by, updated_at
    ) values (
      target_asset_id, target_laboratory_id, certificate_kind,
      nullif(pg_catalog.btrim(certificate_number_value), ''),
      nullif(pg_catalog.btrim(certificate_issuer), ''), certificate_issued_at,
      certificate_expires_at, document_bucket, document_path,
      nullif(pg_catalog.btrim(document_file_name), ''), document_mime_type,
      document_size_bytes, nullif(pg_catalog.btrim(certificate_note), ''),
      (select auth.uid()), now_value
    ) returning id into saved_id;
  else
    update public.asset_certificates
    set
      certificate_type = certificate_kind,
      certificate_number = nullif(pg_catalog.btrim(certificate_number_value), ''),
      issuer = nullif(pg_catalog.btrim(certificate_issuer), ''),
      issued_at = certificate_issued_at,
      expires_at = certificate_expires_at,
      bucket = coalesce(document_bucket, bucket),
      path = coalesce(document_path, path),
      file_name = coalesce(nullif(pg_catalog.btrim(document_file_name), ''), file_name),
      mime_type = coalesce(document_mime_type, mime_type),
      size_bytes = coalesce(document_size_bytes, size_bytes),
      note = nullif(pg_catalog.btrim(certificate_note), ''),
      updated_at = now_value
    where id = target_certificate_id
      and asset_id = target_asset_id
      and laboratory_id = target_laboratory_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Sertifikat tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.asset_activity_logs (
    asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
  ) values (
    target_asset_id, target_laboratory_id, 'sertifikat',
    'Sertifikat atau kalibrasi diperbarui', certificate_kind,
    now_value, (select auth.uid())
  );

  return saved_id;
end;
$$;

revoke all on function public.save_asset_certificate(uuid, uuid, text, text, text, date, date, text, text, text, text, integer, text) from public;
revoke all on function public.save_asset_certificate(uuid, uuid, text, text, text, date, date, text, text, text, text, integer, text) from anon;
grant execute on function public.save_asset_certificate(uuid, uuid, text, text, text, date, date, text, text, text, text, integer, text) to authenticated;

create or replace function public.save_asset_work_order(
  target_work_order_id uuid,
  target_asset_id uuid,
  work_kind text,
  work_status text,
  work_title text,
  work_description text,
  work_findings text,
  work_parts_replaced text,
  work_assigned_to uuid,
  work_opened_at timestamptz,
  work_scheduled_at timestamptz,
  work_completed_at timestamptz,
  work_verification_note text,
  work_return_to_service boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_laboratory_id uuid;
  saved_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
  generated_number text;
begin
  select asset.laboratory_id into target_laboratory_id
  from public.assets as asset where asset.id = target_asset_id;

  if target_laboratory_id is null or not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aset tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if work_kind not in ('preventif', 'korektif', 'inspeksi_khusus', 'kalibrasi')
    or work_status not in (
      'terbuka', 'dijadwalkan', 'dalam_pengerjaan', 'menunggu_verifikasi',
      'selesai', 'dibatalkan'
    ) then
    raise exception 'Jenis atau status work order tidak valid.' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(work_title), '') is null then
    raise exception 'Judul work order wajib diisi.' using errcode = '22023';
  end if;

  if work_assigned_to is not null and not exists (
    select 1 from public.user_profiles as profile
    where profile.id = work_assigned_to
      and profile.is_active = true
      and profile.laboratory_id = target_laboratory_id
      and profile.role = 'teknisi'
  ) then
    raise exception 'Pelaksana harus teknisi aktif pada laboratorium yang sama.' using errcode = '22023';
  end if;

  if work_status = 'selesai' and (
    work_completed_at is null
    or nullif(pg_catalog.btrim(work_verification_note), '') is null
  ) then
    raise exception 'Tanggal selesai dan catatan verifikasi wajib diisi.' using errcode = '22023';
  end if;

  if work_return_to_service and work_status <> 'selesai' then
    raise exception 'Aset hanya dapat dikembalikan beroperasi setelah work order selesai.' using errcode = '22023';
  end if;

  if target_work_order_id is null then
    generated_number := 'WO-' || pg_catalog.to_char(now_value, 'YYYYMMDD-HH24MISS')
      || '-' || pg_catalog.upper(pg_catalog.substr(gen_random_uuid()::text, 1, 4));

    insert into public.asset_work_orders (
      work_order_number, asset_id, laboratory_id, maintenance_type, status,
      title, description, findings, parts_replaced, assigned_to, opened_at,
      scheduled_at, completed_at, verification_note, verified_by, verified_at,
      return_to_service, created_by, updated_at
    ) values (
      generated_number, target_asset_id, target_laboratory_id, work_kind,
      work_status, pg_catalog.btrim(work_title),
      nullif(pg_catalog.btrim(work_description), ''),
      nullif(pg_catalog.btrim(work_findings), ''),
      nullif(pg_catalog.btrim(work_parts_replaced), ''), work_assigned_to,
      coalesce(work_opened_at, now_value), work_scheduled_at, work_completed_at,
      nullif(pg_catalog.btrim(work_verification_note), ''),
      case when work_status = 'selesai' then (select auth.uid()) else null end,
      case when work_status = 'selesai' then now_value else null end,
      work_return_to_service, (select auth.uid()), now_value
    ) returning id into saved_id;
  else
    update public.asset_work_orders
    set
      maintenance_type = work_kind,
      status = work_status,
      title = pg_catalog.btrim(work_title),
      description = nullif(pg_catalog.btrim(work_description), ''),
      findings = nullif(pg_catalog.btrim(work_findings), ''),
      parts_replaced = nullif(pg_catalog.btrim(work_parts_replaced), ''),
      assigned_to = work_assigned_to,
      opened_at = coalesce(work_opened_at, opened_at),
      scheduled_at = work_scheduled_at,
      completed_at = work_completed_at,
      verification_note = nullif(pg_catalog.btrim(work_verification_note), ''),
      verified_by = case when work_status = 'selesai' then (select auth.uid()) else null end,
      verified_at = case when work_status = 'selesai' then now_value else null end,
      return_to_service = work_return_to_service,
      updated_at = now_value
    where id = target_work_order_id
      and asset_id = target_asset_id
      and laboratory_id = target_laboratory_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Work order tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  if work_return_to_service then
    if exists (
      select 1 from public.asset_inspection_reviews as review
      where review.asset_id = target_asset_id
        and review.review_status = 'menunggu'
        and review.recommended_status = 'tidak_layak'
    ) then
      raise exception 'Aset masih memiliki temuan inspeksi kritis yang belum ditinjau.' using errcode = '22023';
    end if;

    update public.assets
    set operational_state = case when status = 'tidak_layak' then 'dikarantina' else 'aktif' end,
        isolation_reason = case
          when status = 'tidak_layak' then coalesce(
            nullif(pg_catalog.btrim(isolation_reason), ''),
            'Aset belum dinyatakan layak setelah work order selesai.'
          )
          else null
        end,
        isolated_at = case
          when status = 'tidak_layak' then coalesce(isolated_at, now_value)
          else null
        end,
        isolated_by = case
          when status = 'tidak_layak' then coalesce(isolated_by, (select auth.uid()))
          else null
        end,
        updated_at = now_value
    where id = target_asset_id;
  elsif work_status in ('dalam_pengerjaan', 'menunggu_verifikasi') then
    update public.assets
    set operational_state = 'dalam_perbaikan',
        isolation_reason = coalesce(isolation_reason, 'Work order ' || coalesce(generated_number, target_work_order_id::text)),
        isolated_at = coalesce(isolated_at, now_value),
        isolated_by = coalesce(isolated_by, (select auth.uid())),
        updated_at = now_value
    where id = target_asset_id;
  end if;

  insert into public.asset_activity_logs (
    asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
  ) values (
    target_asset_id, target_laboratory_id, 'work_order',
    'Work order ' || case when target_work_order_id is null then 'dibuat' else 'diperbarui' end,
    pg_catalog.btrim(work_title) || ' · ' || work_status,
    now_value, (select auth.uid())
  );

  return saved_id;
end;
$$;

revoke all on function public.save_asset_work_order(uuid, uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz, timestamptz, text, boolean) from public;
revoke all on function public.save_asset_work_order(uuid, uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz, timestamptz, text, boolean) from anon;
grant execute on function public.save_asset_work_order(uuid, uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz, timestamptz, text, boolean) to authenticated;

create or replace function public.save_asset_document_metadata(
  target_asset_id uuid,
  document_kind text,
  document_title text,
  document_bucket text,
  document_path text,
  document_file_name text,
  document_mime_type text,
  document_size_bytes integer,
  document_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_laboratory_id uuid;
  saved_id uuid;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select asset.laboratory_id into target_laboratory_id
  from public.assets as asset where asset.id = target_asset_id;

  if target_laboratory_id is null or not public.can_manage_asset_data(target_laboratory_id) then
    raise exception 'Aset tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if document_kind not in ('manual', 'datasheet', 'foto', 'diagram', 'dokumen_lainnya')
    or document_bucket <> 'asset-documents'
    or document_path not like 'assets/' || target_asset_id::text || '/%'
    or nullif(pg_catalog.btrim(document_title), '') is null
    or nullif(pg_catalog.btrim(document_file_name), '') is null then
    raise exception 'Metadata dokumen aset tidak valid.' using errcode = '22023';
  end if;

  insert into public.asset_documents (
    asset_id, laboratory_id, document_type, title, bucket, path, file_name,
    mime_type, size_bytes, note, uploaded_by
  ) values (
    target_asset_id, target_laboratory_id, document_kind,
    pg_catalog.btrim(document_title), document_bucket, document_path,
    pg_catalog.btrim(document_file_name), document_mime_type,
    document_size_bytes, nullif(pg_catalog.btrim(document_note), ''),
    (select auth.uid())
  ) returning id into saved_id;

  insert into public.asset_activity_logs (
    asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
  ) values (
    target_asset_id, target_laboratory_id, 'dokumen',
    'Dokumen aset ditambahkan', pg_catalog.btrim(document_title),
    now_value, (select auth.uid())
  );

  return saved_id;
end;
$$;

revoke all on function public.save_asset_document_metadata(uuid, text, text, text, text, text, text, integer, text) from public;
revoke all on function public.save_asset_document_metadata(uuid, text, text, text, text, text, text, integer, text) from anon;
grant execute on function public.save_asset_document_metadata(uuid, text, text, text, text, text, text, integer, text) to authenticated;

create or replace function public.review_asset_inspection(
  target_review_id uuid,
  decision text,
  reviewer_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_record public.asset_inspection_reviews%rowtype;
  now_value timestamptz := pg_catalog.clock_timestamp();
begin
  select review.* into review_record
  from public.asset_inspection_reviews as review
  where review.id = target_review_id
  for update;

  if not found
    or review_record.review_status <> 'menunggu'
    or not public.can_manage_asset_data(review_record.laboratory_id) then
    raise exception 'Review inspeksi tidak ditemukan atau tidak dapat dikelola.' using errcode = '42501';
  end if;

  if decision not in ('diterapkan', 'ditolak') then
    raise exception 'Keputusan review tidak valid.' using errcode = '22023';
  end if;

  update public.asset_inspection_reviews
  set review_status = decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now_value,
      review_note = nullif(pg_catalog.btrim(reviewer_note), '')
  where id = target_review_id;

  if decision = 'diterapkan' then
    update public.assets
    set
      status = review_record.recommended_status,
      operational_state = case
        when review_record.recommended_status = 'tidak_layak' then 'dikarantina'
        when review_record.recommended_status = 'perlu_dicek' and operational_state = 'aktif'
          then 'penggunaan_dibatasi'
        else operational_state
      end,
      isolation_reason = case
        when review_record.recommended_status = 'tidak_layak'
          then 'Hasil checklist K3 merekomendasikan aset tidak layak.'
        else isolation_reason
      end,
      isolated_at = case
        when review_record.recommended_status = 'tidak_layak' then now_value
        else isolated_at
      end,
      isolated_by = case
        when review_record.recommended_status = 'tidak_layak' then (select auth.uid())
        else isolated_by
      end,
      updated_at = now_value
    where id = review_record.asset_id;
  end if;

  insert into public.asset_activity_logs (
    asset_id, laboratory_id, activity_type, title, note, occurred_at, created_by
  ) values (
    review_record.asset_id, review_record.laboratory_id, 'review_inspeksi',
    case when decision = 'diterapkan'
      then 'Rekomendasi inspeksi diterapkan'
      else 'Rekomendasi inspeksi tidak diterapkan'
    end,
    'Rekomendasi status: ' || review_record.recommended_status
      || coalesce('. Catatan: ' || nullif(pg_catalog.btrim(reviewer_note), ''), ''),
    now_value, (select auth.uid())
  );

  return target_review_id;
end;
$$;

revoke all on function public.review_asset_inspection(uuid, text, text) from public;
revoke all on function public.review_asset_inspection(uuid, text, text) from anon;
grant execute on function public.review_asset_inspection(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Synchronize completed checklist data to the asset register only after all
-- checklist child items have been inserted by the atomic workflow.
-- ---------------------------------------------------------------------------

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
      pg_catalog.bool_or(item.is_critical and answer.answer = 'tidak') as has_critical_failure,
      pg_catalog.bool_or(answer.answer = 'tidak') as has_failure
    from inserted_checklist_items as inserted
    join public.checklist_result_items as answer on answer.id = inserted.id
    join public.checklist_results as result on result.id = answer.result_id
    join public.checklist_items as item on item.id = answer.item_id
    where result.asset_id is not null
    group by result.id, result.asset_id, result.laboratory_id, result.completed_at
  loop
    recommended := case
      when inspection.has_critical_failure then 'tidak_layak'::public.asset_status
      when inspection.has_failure then 'perlu_dicek'::public.asset_status
      else 'layak'::public.asset_status
    end;

    update public.assets
    set
      last_inspection_at = inspection.completed_at,
      next_inspection_at = inspection.completed_at
        + (inspection_interval_days * interval '1 day'),
      updated_at = pg_catalog.clock_timestamp()
    where id = inspection.asset_id
      and laboratory_id = inspection.laboratory_id
      and (
        last_inspection_at is null
        or inspection.completed_at >= last_inspection_at
      );

    insert into public.asset_inspection_reviews (
      checklist_result_id, asset_id, laboratory_id, recommended_status
    ) values (
      inspection.result_id, inspection.asset_id, inspection.laboratory_id, recommended
    ) on conflict (checklist_result_id) do nothing;
  end loop;

  return null;
end;
$$;

revoke all on function public.sync_asset_after_checklist_items() from public;
revoke all on function public.sync_asset_after_checklist_items() from anon;

drop trigger if exists sync_asset_after_checklist_items_trigger
  on public.checklist_result_items;
create trigger sync_asset_after_checklist_items_trigger
after insert on public.checklist_result_items
referencing new table as inserted_checklist_items
for each statement execute function public.sync_asset_after_checklist_items();

-- Expand the immutable activity vocabulary used by migration 008.
alter table public.asset_activity_logs
  drop constraint if exists asset_activity_logs_activity_type_check;
alter table public.asset_activity_logs
  add constraint asset_activity_logs_activity_type_check check (
    activity_type in (
      'aset_dibuat', 'aset_diperbarui', 'sop_diperbarui', 'servis',
      'perbaikan', 'catatan', 'status_operasional', 'sertifikat',
      'work_order', 'kontrol_keselamatan', 'dokumen', 'review_inspeksi'
    )
  );

-- ---------------------------------------------------------------------------
-- Private asset document storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-documents',
  'asset-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "asset managers can upload documents" on storage.objects;
create policy "asset managers can upload documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'asset-documents'
  and (storage.foldername(name))[1] = 'assets'
  and array_length(storage.foldername(name), 1) = 2
  and lower(storage.extension(name)) in ('pdf', 'jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1 from public.assets as asset
    where asset.id::text = (storage.foldername(name))[2]
      and public.can_manage_asset_data(asset.laboratory_id)
  )
);

drop policy if exists "active users can read asset documents" on storage.objects;
create policy "active users can read asset documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'asset-documents'
  and (storage.foldername(name))[1] = 'assets'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1 from public.assets as asset
    where asset.id::text = (storage.foldername(name))[2]
      and public.can_access_laboratory(asset.laboratory_id)
  )
);

drop policy if exists "asset managers can delete documents" on storage.objects;
create policy "asset managers can delete documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'asset-documents'
  and (storage.foldername(name))[1] = 'assets'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1 from public.assets as asset
    where asset.id::text = (storage.foldername(name))[2]
      and public.can_manage_asset_data(asset.laboratory_id)
  )
);

commit;
