-- VocaSafe Lab Phase 1: persistent per-user rate limiting for the AI endpoint.
-- Review and run manually after 002_d4_rls_hardening.sql.

begin;

create table public.ai_rate_limits (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  endpoint text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.ai_rate_limits enable row level security;

-- Browser clients cannot access counters directly. All access goes through the
-- authenticated SECURITY DEFINER function below.
revoke all on table public.ai_rate_limits from public;
revoke all on table public.ai_rate_limits from anon;
revoke all on table public.ai_rate_limits from authenticated;

create or replace function public.consume_ai_rate_limit(p_endpoint text)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_endpoint text := pg_catalog.btrim(p_endpoint);
  v_now timestamptz;
  v_limit constant integer := 10;
  v_window interval := interval '60 seconds';
  v_row public.ai_rate_limits%rowtype;
  v_next_count integer;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required.';
  end if;

  if v_endpoint is distinct from 'risk-recommendation' then
    raise exception using
      errcode = '22023',
      message = 'Unsupported rate-limit endpoint.';
  end if;

  if not exists (
    select 1
    from public.user_profiles profile
    where profile.id = v_user_id
      and profile.is_active = true
  ) then
    raise exception using
      errcode = '42501',
      message = 'Active profile required.';
  end if;

  -- The transaction-scoped advisory lock serializes this user/endpoint pair,
  -- including the first request before a counter row exists.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || v_endpoint, 0)
  );

  v_now := pg_catalog.clock_timestamp();

  select rate_limit.*
  into v_row
  from public.ai_rate_limits rate_limit
  where rate_limit.user_id = v_user_id
    and rate_limit.endpoint = v_endpoint
  for update;

  if not found then
    insert into public.ai_rate_limits (
      user_id,
      endpoint,
      window_started_at,
      request_count,
      updated_at
    )
    values (v_user_id, v_endpoint, v_now, 1, v_now);

    return query select true, v_limit - 1, 60;
    return;
  end if;

  if v_now >= v_row.window_started_at + v_window then
    update public.ai_rate_limits rate_limit
    set window_started_at = v_now,
        request_count = 1,
        updated_at = v_now
    where rate_limit.user_id = v_user_id
      and rate_limit.endpoint = v_endpoint;

    return query select true, v_limit - 1, 60;
    return;
  end if;

  v_retry_after := least(
    60,
    greatest(
      1,
      pg_catalog.ceil(
        extract(epoch from (v_row.window_started_at + v_window - v_now))
      )::integer
    )
  );

  if v_row.request_count >= v_limit then
    return query select false, 0, v_retry_after;
    return;
  end if;

  v_next_count := v_row.request_count + 1;

  update public.ai_rate_limits rate_limit
  set request_count = v_next_count,
      updated_at = v_now
  where rate_limit.user_id = v_user_id
    and rate_limit.endpoint = v_endpoint;

  return query select true, v_limit - v_next_count, v_retry_after;
end;
$$;

revoke all on function public.consume_ai_rate_limit(text) from public;
revoke all on function public.consume_ai_rate_limit(text) from anon;
grant execute on function public.consume_ai_rate_limit(text) to authenticated;

commit;
