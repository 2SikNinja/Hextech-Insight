-- Compact per-match timeline details for the match page: per-minute gold/XP/CS,
-- item purchases and sales, skill order, kills and objectives.
-- Already included in supabase/schema.sql for new projects.

create table if not exists public.match_timeline_details (
  match_id    text primary key references public.matches (match_id) on delete cascade,
  details     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.match_timeline_details enable row level security;
revoke all on public.match_timeline_details from anon, authenticated;
