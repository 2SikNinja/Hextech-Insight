-- LP history and storage cleanup.
-- Already included in supabase/schema.sql for new projects.

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
