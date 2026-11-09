-- Adds: Riot API budget and per-visitor limits, early-game timeline stats, and
-- champion mastery. Already included in supabase/schema.sql for new projects.

-- ---------------------------------------------------------------------------
-- Champion mastery (top champions), refreshed with the profile.
-- ---------------------------------------------------------------------------
alter table public.summoners
  add column if not exists top_mastery jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Early-game snapshots from the Match-V5 timeline: one row per player per match.
-- ---------------------------------------------------------------------------
alter table public.matches
  add column if not exists timeline_status text not null default 'pending',
  add constraint matches_timeline_status_check
    check (timeline_status in ('pending', 'done', 'unavailable'));

create index if not exists matches_timeline_pending_idx
  on public.matches (match_id) where timeline_status = 'pending';

create table if not exists public.participant_timeline (
  match_id  text not null references public.matches (match_id) on delete cascade,
  puuid     text not null,
  gold_10   integer,
  cs_10     integer,
  xp_10     integer,
  gold_15   integer,
  cs_15     integer,
  xp_15     integer,
  primary key (match_id, puuid)
);

-- ---------------------------------------------------------------------------
-- Riot API budget. Every action that calls Riot reserves an estimated number of
-- requests here first, so the site stays under the key's rate limit and one
-- visitor cannot use up the budget for everyone.
-- ---------------------------------------------------------------------------
create table if not exists public.api_usage (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  action      text not null,
  cost        integer not null check (cost >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists api_usage_created_idx on public.api_usage (created_at);
create index if not exists api_usage_ip_idx on public.api_usage (ip_hash, action, created_at);

create or replace function public.reserve_riot_budget(
  p_ip_hash        text,
  p_action         text,
  p_cost           integer,
  p_ip_limit       integer,  -- max actions of this kind per visitor per window (0 = no limit)
  p_ip_window      integer,  -- seconds
  p_global_limit   integer,  -- max Riot requests across the site per window
  p_global_window  integer   -- seconds
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  visitor_count integer;
  visitor_oldest timestamptz;
  used integer;
  global_oldest timestamptz;
begin
  -- One reservation at a time, so two requests cannot both squeeze under the limit.
  perform pg_advisory_xact_lock(hashtext('reserve_riot_budget'));

  delete from api_usage where created_at < now() - interval '1 day';

  if p_ip_limit > 0 then
    select count(*), min(created_at) into visitor_count, visitor_oldest
    from api_usage
    where ip_hash = p_ip_hash
      and action = p_action
      and created_at > now() - make_interval(secs => p_ip_window);

    if visitor_count >= p_ip_limit then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'visitor',
        'retry_after', greatest(1, ceil(p_ip_window - extract(epoch from now() - visitor_oldest)))::integer
      );
    end if;
  end if;

  select coalesce(sum(cost), 0), min(created_at) into used, global_oldest
  from api_usage
  where created_at > now() - make_interval(secs => p_global_window);

  if used + p_cost > p_global_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global',
      'retry_after', greatest(1, ceil(p_global_window - extract(epoch from now() - global_oldest)))::integer
    );
  end if;

  insert into api_usage (ip_hash, action, cost) values (p_ip_hash, p_action, p_cost);
  return jsonb_build_object('allowed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Same lockdown as the other tables: only the server's secret key has access.
-- ---------------------------------------------------------------------------
alter table public.participant_timeline enable row level security;
alter table public.api_usage            enable row level security;

revoke all on public.participant_timeline from anon, authenticated;
revoke all on public.api_usage            from anon, authenticated;

revoke execute on function public.reserve_riot_budget(text, text, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_riot_budget(text, text, integer, integer, integer, integer, integer)
  to service_role;
