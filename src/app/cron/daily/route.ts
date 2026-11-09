import { getDb } from '@/lib/db'

// Daily job (vercel.json "schedules"). Vercel sends
// "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger it.
//
// 1. Keeps the database awake: Supabase pauses free projects after about a
//    week without activity, which would take the site down.
// 2. Clears rate-limit records older than a day.
// 3. Keeps storage under Supabase's free 500 MB: once the database passes
//    400 MB, the full Riot payload of the oldest matches (older than 30 days)
//    is trimmed. Stats rows stay, so player stats and insights are unaffected.

const trimThresholdBytes = 400 * 1024 * 1024
const trimMinAgeDays = 30
const trimBatchSize = 500

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = getDb()
  const [players, matches, cleanup, trim] = await Promise.all([
    db.from('summoners').select('puuid', { count: 'exact', head: true }),
    db.from('matches').select('match_id', { count: 'exact', head: true }),
    db
      .from('api_usage')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    db.rpc('trim_old_match_payloads', {
      p_max_database_bytes: trimThresholdBytes,
      p_min_age_days: trimMinAgeDays,
      p_batch: trimBatchSize,
    }),
  ])

  const error = players.error ?? matches.error ?? cleanup.error ?? trim.error
  if (error) {
    console.error('Daily job failed', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const storage = trim.data as { database_bytes: number; trimmed: number }
  return Response.json({
    ok: true,
    players: players.count ?? 0,
    matches: matches.count ?? 0,
    clearedUsageRows: cleanup.count ?? 0,
    databaseMegabytes: Math.round(storage.database_bytes / 1024 / 1024),
    trimmedMatches: storage.trimmed,
  })
}
