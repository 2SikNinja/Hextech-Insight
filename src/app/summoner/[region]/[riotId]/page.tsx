import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { GameImage } from '@/components/GameImage'
import { MatchList } from '@/components/MatchList'
import { PageMessage } from '@/components/PageMessage'
import { RankPanel } from '@/components/RankPanel'
import { RefreshButton } from '@/components/RefreshButton'
import { StatsPanel } from '@/components/StatsPanel'
import { type GameData, championIconUrl, getGameData, profileIconUrl } from '@/lib/ddragon'
import { describeError } from '@/lib/errors'
import { formatTier, formatTimeAgo } from '@/lib/format'
import { getMatchHistory } from '@/lib/matches'
import { getQueueFilter, queueFilters } from '@/lib/riot/queues'
import { type Region, getRegionBySlug } from '@/lib/riot/regions'
import { formatRiotId, parseRiotIdSlug, summonerPath } from '@/lib/riot/riotId'
import { type LookupResult, lookupSummoner } from '@/lib/summoners'

type SummonerPageProps = PageProps<'/summoner/[region]/[riotId]'>

export async function generateMetadata({ params }: SummonerPageProps): Promise<Metadata> {
  const { region: regionSlug, riotId: riotIdSlug } = await params
  const region = getRegionBySlug(regionSlug)
  const riotId = parseRiotIdSlug(riotIdSlug)
  if (!region || !riotId) return { title: 'Player not found' }

  const name = formatRiotId(riotId)
  return {
    title: `${name} (${region.shortLabel})`,
    description: `Rank, recent matches and champion stats for ${name} on ${region.label}.`,
  }
}

export default function SummonerPage(props: SummonerPageProps) {
  return (
    <Suspense fallback={<SummonerSkeleton />}>
      <SummonerView {...props} />
    </Suspense>
  )
}

async function SummonerView({ params, searchParams }: SummonerPageProps) {
  const [{ region: regionSlug, riotId: riotIdSlug }, query] = await Promise.all([params, searchParams])
  const region = getRegionBySlug(regionSlug)
  const riotId = parseRiotIdSlug(riotIdSlug)
  if (!region || !riotId) notFound()

  const queueFilter = getQueueFilter(typeof query.queue === 'string' ? query.queue : undefined)

  let lookup: LookupResult
  try {
    lookup = await lookupSummoner(region, riotId)
  } catch (error) {
    const friendly = describeError(error, {
      notFound: `No player named ${formatRiotId(riotId)} plays on ${region.label}. Check the tag after the # and the region.`,
    })
    return (
      <PageMessage title={friendly.title} tone="error">
        <p>{friendly.message}</p>
        <p>
          <Link href="/" className="text-accent hover:text-ink">
            Search again
          </Link>
        </p>
      </PageMessage>
    )
  }

  const { summoner } = lookup
  const [gameData, history] = await Promise.all([
    getGameData(),
    getMatchHistory(summoner.puuid, { queueIds: queueFilter.queueIds }),
  ])

  const canonicalRiotId = { gameName: summoner.game_name, tagLine: summoner.tag_line }
  const basePath = summonerPath(region.slug, canonicalRiotId)
  const iconUrl = profileIconUrl(gameData, summoner.profile_icon_id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Profile */}
      <header className="flex flex-wrap items-center gap-5 border-b border-line pb-6">
        <div className="relative">
          <GameImage src={iconUrl} alt="" size={88} className="ring-1 ring-line-strong" />
          <span className="tabular absolute -bottom-2 left-1/2 -translate-x-1/2 border border-accent-soft bg-canvas px-2 text-xs text-ink">
            {summoner.summoner_level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold text-ink">
            {summoner.game_name}
            <span className="ml-1 font-normal text-muted">#{summoner.tag_line}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {region.label}
            <span className="ml-3">Updated {formatTimeAgo(summoner.refreshed_at)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <FavoriteButton
              regionSlug={region.slug}
              regionLabel={region.shortLabel}
              gameName={summoner.game_name}
              tagLine={summoner.tag_line}
              iconUrl={iconUrl}
              rankLabel={formatTier(summoner.solo_tier, summoner.solo_division)}
            />
            <RefreshButton puuid={summoner.puuid} />
          </div>
        </div>
      </header>

      {lookup.ingest?.rateLimited && (
        <p role="status" className="mt-4 border-l-2 border-accent bg-surface px-4 py-3 text-sm text-text">
          Riot&apos;s API is busy, so only some recent games loaded. Press Update in a minute to get the rest.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="flex flex-col gap-6">
          <RankPanel summoner={summoner} />
          <StatsPanel
            key={`${summoner.refreshed_at}-${queueFilter.slug}`}
            puuid={summoner.puuid}
            queueIds={queueFilter.queueIds}
            queueLabel={queueFilter.label}
            {...championLookups(gameData)}
          />
        </aside>

        <section aria-labelledby="history-heading" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 id="history-heading" className="text-lg font-semibold text-ink">
              Recent games
            </h2>
            <QueueTabs basePath={basePath} activeSlug={queueFilter.slug} />
          </div>

          {history.length > 0 ? (
            <MatchList entries={history} gameData={gameData} regionSlug={region.slug} />
          ) : (
            <EmptyHistory region={region} filterLabel={queueFilter.label} isFiltered={queueFilter.slug !== 'all'} />
          )}
        </section>
      </div>
    </div>
  )
}

/** Champion icon and name maps for the client-side stats surface. */
function championLookups(gameData: GameData) {
  const championIcons: Record<string, string> = {}
  const championNames: Record<string, string> = {}
  for (const [championId, champion] of Object.entries(gameData.champions)) {
    championIcons[championId] = championIconUrl(gameData, Number(championId))
    championNames[championId] = champion.name
  }
  return { championIcons, championNames }
}

function QueueTabs({ basePath, activeSlug }: { basePath: string; activeSlug: string }) {
  return (
    <nav aria-label="Filter by queue" className="flex flex-wrap gap-1 text-sm">
      {queueFilters.map((filter) => {
        const isActive = filter.slug === activeSlug
        return (
          <Link
            key={filter.slug}
            href={filter.slug === 'all' ? basePath : `${basePath}?queue=${filter.slug}`}
            aria-current={isActive ? 'page' : undefined}
            scroll={false}
            className={`border px-3 py-1 transition-colors ${
              isActive ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'
            }`}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}

function EmptyHistory({ region, filterLabel, isFiltered }: { region: Region; filterLabel: string; isFiltered: boolean }) {
  return (
    <div className="border border-line bg-surface px-5 py-10 text-center">
      <p className="text-ink">
        {isFiltered ? `No ${filterLabel} games stored for this player.` : 'No recent games found.'}
      </p>
      <p className="mt-2 text-sm text-muted">
        {isFiltered
          ? 'Try another queue, or press Update to check for new games.'
          : `This player has no recent matches on ${region.label}. Press Update after they play.`}
      </p>
    </div>
  )
}

function SummonerSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-label="Loading player">
      <div className="flex items-center gap-5 border-b border-line pb-6">
        <div className="size-[88px] animate-pulse bg-surface-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-8 w-56 animate-pulse bg-surface-muted" />
          <div className="h-4 w-32 animate-pulse bg-surface-muted" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        Loading player. The first lookup downloads their recent games from Riot and can take a few seconds.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="h-64 animate-pulse bg-surface" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse bg-surface" />
          ))}
        </div>
      </div>
    </div>
  )
}
