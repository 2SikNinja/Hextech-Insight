-- Hextech Insight database schema
--
-- Supabase is a cache for Riot API data, so each finished match is fetched from
-- Riot once and then served from here.
--
-- New project: run this whole file once in the Supabase SQL Editor.
-- Existing project created before the features update: run migrations/002_features.sql instead.
--
-- Access model: there are no user accounts. Only server code (Next.js and the
-- Python stats service) talks to the database, using the secret key, which
-- bypasses row level security. RLS is still enabled with no policies, so the
-- public (anon / publishable) key can read and write nothing.

-- ---------------------------------------------------------------------------
-- Summoners: one row per Riot account we have looked up.
-- ---------------------------------------------------------------------------
create table public.summoners (
  puuid            text primary key,
  platform         text not null,                 -- na1, euw1, kr, ...
  game_name        text not null,
  tag_line         text not null,
  profile_icon_id  integer not null default 29,
  summoner_level   integer not null default 1,

  -- Ranked Solo/Duo
  solo_tier        text,                          -- GOLD, DIAMOND, ... (null = unranked)
  solo_division    text,                          -- I, II, III, IV
  solo_lp          integer,
  solo_wins        integer,
  solo_losses      integer,

  -- Ranked Flex
  flex_tier        text,
  flex_division    text,
  flex_lp          integer,
  flex_wins        integer,
  flex_losses      integer,

  -- Lowercased "gamename#tagline" for case-insensitive lookups.
  riot_id_key      text generated always as (lower(game_name || '#' || tag_line)) stored,

  -- When we last pulled fresh data from Riot (drives the refresh cooldown).
  refreshed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  constraint summoners_platform_check check (
    platform in ('na1', 'br1', 'la1', 'la2', 'kr', 'jp1', 'euw1', 'eun1', 'tr1', 'ru', 'oc1', 'me1', 'sg2', 'tw2', 'vn2')
  ),
  constraint summoners_solo_lp_check check (solo_lp is null or solo_lp >= 0),
  constraint summoners_flex_lp_check check (flex_lp is null or flex_lp >= 0)
);

-- Case-insensitive Riot ID lookup ("2sikninja#2sik" finds "2SikNinja#2Sik").
create index summoners_riot_id_idx
  on public.summoners (platform, riot_id_key);

-- ---------------------------------------------------------------------------
-- Matches: one row per match. The full Riot payload is kept in raw_data so the
-- match detail page never needs to call Riot again.
-- ---------------------------------------------------------------------------
create table public.matches (
  match_id        text primary key,                -- e.g. NA1_5012345678
  platform        text not null,
  queue_id        integer not null,
  game_mode       text not null,
  game_version    text not null,                   -- e.g. 15.21.715.1234
  game_start      timestamptz not null,
  duration_secs   integer not null,
  raw_data        jsonb not null,
  created_at      timestamptz not null default now(),

  constraint matches_duration_check check (duration_secs >= 0)
);

create index matches_game_start_idx on public.matches (game_start desc);

-- ---------------------------------------------------------------------------
-- Match participants: one row per player per match (10 per normal game, 16 in Arena).
-- Flat columns so the Python stats service can aggregate without parsing JSON.
-- ---------------------------------------------------------------------------
create table public.match_participants (
  match_id          text not null references public.matches (match_id) on delete cascade,
  puuid             text not null,
  participant_id    smallint not null,             -- 1..10 (1..16 in Arena)

  -- Copied from the match so per-player queries need no join.
  queue_id          integer not null,
  game_start        timestamptz not null,
  duration_secs     integer not null,

  riot_id_name      text,
  riot_id_tag       text,
  team_id           smallint not null,             -- 100 blue, 200 red (Arena uses subteams)
  team_position     text,                          -- TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY, or empty
  champion_id       integer not null,
  champion_name     text not null,
  champion_level    smallint not null,
  win               boolean not null,
  remake            boolean not null default false,

  kills             smallint not null,
  deaths            smallint not null,
  assists           smallint not null,
  cs                integer not null,              -- lane minions + jungle monsters
  gold_earned       integer not null,
  damage_to_champs  integer not null,
  damage_taken      integer not null,
  vision_score      integer not null,
  kill_participation real,                         -- 0..1, null if team had no kills

  summoner_spell_1  integer not null,
  summoner_spell_2  integer not null,
  items             integer[] not null,            -- 7 slots, 0 = empty
  primary_rune      integer,
  secondary_style   integer,

  double_kills      smallint not null default 0,
  triple_kills      smallint not null default 0,
  quadra_kills      smallint not null default 0,
  penta_kills       smallint not null default 0,

  primary key (match_id, puuid),

  constraint participants_kda_check check (kills >= 0 and deaths >= 0 and assists >= 0),
  constraint participants_items_check check (cardinality(items) = 7),
  constraint participants_kp_check check (kill_participation is null or kill_participation between 0 and 1)
);

-- Match history and stats: "this player's games, newest first", optionally by queue.
create index participants_player_history_idx
  on public.match_participants (puuid, game_start desc);

create index participants_player_queue_idx
  on public.match_participants (puuid, queue_id, game_start desc);

-- ---------------------------------------------------------------------------
-- Lock everything down. Server code uses the secret key, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.summoners          enable row level security;
alter table public.matches            enable row level security;
alter table public.match_participants enable row level security;

revoke all on public.summoners          from anon, authenticated;
revoke all on public.matches            from anon, authenticated;
revoke all on public.match_participants from anon, authenticated;

-- ===========================================================================
-- Features added later (identical to supabase/migrations/002_features.sql)
-- ===========================================================================

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
