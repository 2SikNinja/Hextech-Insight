-- Player directory for search suggestions.
--
-- Riot's API has no name search, so suggestions come from players this site
-- already knows: everyone looked up directly plus every player seen in a stored
-- match. Already included in supabase/schema.sql for new projects.

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

-- Backfill from data already stored.
select public.upsert_player_directory(coalesce((
  select jsonb_agg(jsonb_build_object(
    'puuid', p.puuid,
    'platform', m.platform,
    'game_name', p.riot_id_name,
    'tag_line', p.riot_id_tag,
    'last_seen', p.game_start
  ))
  from public.match_participants p
  join public.matches m on m.match_id = p.match_id
), '[]'::jsonb));

select public.upsert_player_directory(coalesce((
  select jsonb_agg(jsonb_build_object(
    'puuid', s.puuid,
    'platform', s.platform,
    'game_name', s.game_name,
    'tag_line', s.tag_line,
    'profile_icon_id', s.profile_icon_id,
    'has_profile', true,
    'last_seen', s.refreshed_at
  ))
  from public.summoners s
), '[]'::jsonb));

alter table public.player_directory enable row level security;
revoke all on public.player_directory from anon, authenticated;

revoke execute on function public.upsert_player_directory(jsonb) from public, anon, authenticated;
revoke execute on function public.search_players(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.upsert_player_directory(jsonb) to service_role;
grant execute on function public.search_players(text, text, text, integer) to service_role;
