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

-- ===========================================================================
-- Player directory for search suggestions (identical to migrations/003_player_directory.sql)
-- ===========================================================================

create table if not exists public.player_directory (
  puuid            text primary key,
  platform         text not null,
  game_name        text not null,
  tag_line         text not null,
  name_key         text generated always as (lower(game_name)) stored,
  tag_key          text generated always as (lower(tag_line)) stored,
  profile_icon_id  integer,                          -- known once the player is looked up directly
  has_profile      boolean not null default false,   -- true when the player has a stored profile page
  last_seen        timestamptz not null default now()
);

-- Prefix search ("2sik" matches "2SikNinja") within a region.
create index if not exists player_directory_prefix_idx
  on public.player_directory (platform, name_key text_pattern_ops);

-- Adds or refreshes directory rows. Riot IDs can change, so a row only takes a
-- new name when the information is newer than what is stored.
create or replace function public.upsert_player_directory(p_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into player_directory (puuid, platform, game_name, tag_line, profile_icon_id, has_profile, last_seen)
  select distinct on (row_data->>'puuid')
    row_data->>'puuid',
    row_data->>'platform',
    row_data->>'game_name',
    row_data->>'tag_line',
    (row_data->>'profile_icon_id')::integer,
    coalesce((row_data->>'has_profile')::boolean, false),
    (row_data->>'last_seen')::timestamptz
  from jsonb_array_elements(p_rows) as row_data
  where coalesce(row_data->>'game_name', '') <> '' and coalesce(row_data->>'tag_line', '') <> ''
  order by row_data->>'puuid', (row_data->>'last_seen')::timestamptz desc
  on conflict (puuid) do update set
    game_name       = case when excluded.last_seen >= player_directory.last_seen then excluded.game_name else player_directory.game_name end,
    tag_line        = case when excluded.last_seen >= player_directory.last_seen then excluded.tag_line else player_directory.tag_line end,
    platform        = case when excluded.last_seen >= player_directory.last_seen then excluded.platform else player_directory.platform end,
    profile_icon_id = coalesce(excluded.profile_icon_id, player_directory.profile_icon_id),
    has_profile     = player_directory.has_profile or excluded.has_profile,
    last_seen       = greatest(excluded.last_seen, player_directory.last_seen);
$$;

-- Up to p_limit players whose name starts with p_name (and tag with p_tag, if
-- given). Players with a profile page come first, then the most recently seen.
create or replace function public.search_players(p_platform text, p_name text, p_tag text, p_limit integer)
returns table (game_name text, tag_line text, profile_icon_id integer, has_profile boolean)
language sql
stable
security definer
set search_path = public
as $$
  select game_name, tag_line, profile_icon_id, has_profile
  from player_directory
  where platform = p_platform
    and name_key like replace(replace(replace(lower(p_name), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and (p_tag is null or p_tag = '' or tag_key like replace(replace(replace(lower(p_tag), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by (name_key = lower(p_name)) desc, has_profile desc, last_seen desc
  limit least(greatest(p_limit, 1), 10);
$$;

alter table public.player_directory enable row level security;
revoke all on public.player_directory from anon, authenticated;

revoke execute on function public.upsert_player_directory(jsonb) from public, anon, authenticated;
revoke execute on function public.search_players(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.upsert_player_directory(jsonb) to service_role;
grant execute on function public.search_players(text, text, text, integer) to service_role;

-- ===========================================================================
-- Match timeline details (identical to migrations/004_match_timeline_details.sql)
-- ===========================================================================

create table if not exists public.match_timeline_details (
  match_id    text primary key references public.matches (match_id) on delete cascade,
  details     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.match_timeline_details enable row level security;
revoke all on public.match_timeline_details from anon, authenticated;

-- ===========================================================================
-- LP history and storage cleanup (identical to migrations/005_lp_history_and_cleanup.sql)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- LP history. Riot only reports a player's current rank, so the site records a
-- snapshot whenever a profile is looked up or updated and the rank changed.
-- ---------------------------------------------------------------------------
create table if not exists public.rank_history (
  id           bigint generated always as identity primary key,
  puuid        text not null,
  queue        text not null check (queue in ('solo', 'flex')),
  tier         text not null,
  division     text,
  lp           integer not null check (lp >= 0),
  wins         integer not null,
  losses       integer not null,
  recorded_at  timestamptz not null default now()
);

create index if not exists rank_history_player_idx
  on public.rank_history (puuid, queue, recorded_at desc);

-- Inserts a snapshot only when something changed since the last one.
create or replace function public.record_rank_snapshot(
  p_puuid text, p_queue text, p_tier text, p_division text, p_lp integer, p_wins integer, p_losses integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into rank_history (puuid, queue, tier, division, lp, wins, losses)
  select p_puuid, p_queue, p_tier, p_division, p_lp, p_wins, p_losses
  where not exists (
    select 1 from (
      select tier, division, lp, wins, losses
      from rank_history
      where puuid = p_puuid and queue = p_queue
      order by recorded_at desc
      limit 1
    ) latest
    where latest.tier = p_tier
      and latest.division is not distinct from p_division
      and latest.lp = p_lp
      and latest.wins = p_wins
      and latest.losses = p_losses
  );
$$;

-- ---------------------------------------------------------------------------
-- Storage cleanup. Supabase's free plan allows 500 MB. Once the database grows
-- past a threshold, the full Riot payload and timeline details of the oldest
-- matches are trimmed. Their stats rows (match_participants) stay, so player
-- stats and insights are unaffected; the match page downloads a trimmed match
-- again if someone opens it.
-- ---------------------------------------------------------------------------
alter table public.matches alter column raw_data drop not null;

create or replace function public.trim_old_match_payloads(
  p_max_database_bytes bigint, p_min_age_days integer, p_batch integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  database_bytes bigint := pg_database_size(current_database());
  trimmed integer := 0;
begin
  if database_bytes < p_max_database_bytes then
    return jsonb_build_object('database_bytes', database_bytes, 'trimmed', 0);
  end if;

  with oldest as (
    select match_id from matches
    where raw_data is not null and game_start < now() - make_interval(days => p_min_age_days)
    order by game_start
    limit p_batch
  ), cleared_details as (
    delete from match_timeline_details where match_id in (select match_id from oldest)
  )
  update matches set raw_data = null, timeline_status = 'pending'
  where match_id in (select match_id from oldest);
  get diagnostics trimmed = row_count;

  return jsonb_build_object('database_bytes', database_bytes, 'trimmed', trimmed);
end;
$$;

alter table public.rank_history enable row level security;
revoke all on public.rank_history from anon, authenticated;

revoke execute on function public.record_rank_snapshot(text, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.trim_old_match_payloads(bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.record_rank_snapshot(text, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.trim_old_match_payloads(bigint, integer, integer) to service_role;
