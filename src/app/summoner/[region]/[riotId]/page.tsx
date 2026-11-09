import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { GameImage } from '@/components/GameImage'
import { InsightsPanel } from '@/components/InsightsPanel'
import { LiveGameButton } from '@/components/LiveGame'
import { LpHistory } from '@/components/LpHistory'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { MasteryPanel } from '@/components/MasteryPanel'
import { MatchList } from '@/components/MatchList'
import { PageMessage } from '@/components/PageMessage'
import { RankPanel } from '@/components/RankPanel'
import { RefreshButton } from '@/components/RefreshButton'
import { StatsPanel } from '@/components/StatsPanel'
import { type GameData, championIconUrl, getGameData, profileIconUrl } from '@/lib/ddragon'
import { describeError } from '@/lib/errors'
import { getLiveStatus } from '@/lib/live'
import { formatTier, formatTimeAgo } from '@/lib/format'
import { getMatchHistory } from '@/lib/matches'
import { getQueueFilter, queueFilters } from '@/lib/riot/queues'
import { type Platform, type Region, getRegionBySlug } from '@/lib/riot/regions'
import { formatRiotId, parseRiotIdSlug, summonerPath, toRiotIdSlug } from '@/lib/riot/riotId'
import { type LookupResult, getRankHistory, lookupSummoner, scheduleTimelineBackfill } from '@/lib/summoners'

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
  const view: View = query.view === 'insights' ? 'insights' : 'matches'
  const shown = clampShown(typeof query.show === 'string' ? Number(query.show) : pageSize)

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
  // Fetch early-game timelines in the background for the Insights tab.
  scheduleTimelineBackfill(region, summoner.puuid)

  const [gameData, history, rankHistory] = await Promise.all([
    getGameData(),
    view === 'matches' ? getMatchHistory(summoner.puuid, { queueIds: queueFilter.queueIds, limit: shown }) : Promise.resolve([]),
    getRankHistory(summoner.puuid).catch((error) => {
      console.warn('LP history unavailable', error)
      return []
    }),
  ])

  const canonicalRiotId = { gameName: summoner.game_name, tagLine: summoner.tag_line }
  const basePath = summonerPath(region.slug, canonicalRiotId)
  const hrefFor = (changes: Partial<PageState>) => buildHref(basePath, { queue: queueFilter.slug, view, show: shown, ...changes })
  const iconUrl = profileIconUrl(gameData, summoner.profile_icon_id)
  const lookups = championLookups(gameData)

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
            <Link
              href={`/compare?a=${region.slug}/${toRiotIdSlug(canonicalRiotId)}`}
              className="inline-flex items-center border border-line-strong px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent"
            >
              Compare
            </Link>
            <RefreshButton puuid={summoner.puuid} />
            <Suspense fallback={<LiveGameButton puuid={summoner.puuid} initialStatus="unknown" />}>
              <LiveStatusButton platform={region.platform} puuid={summoner.puuid} />
            </Suspense>
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
          <LpHistory
            points={rankHistory.map((point) => ({
              queue: point.queue,
              tier: point.tier,
              division: point.division,
              lp: point.lp,
              wins: point.wins,
              losses: point.losses,
              recordedAt: point.recorded_at,
            }))}
          />
          <StatsPanel
            championBasePath={basePath}
            key={`${summoner.refreshed_at}-${queueFilter.slug}`}
            puuid={summoner.puuid}
            queueIds={queueFilter.queueIds}
            queueLabel={queueFilter.label}
            {...lookups}
          />
          <MasteryPanel mastery={summoner.top_mastery ?? []} gameData={gameData} />
        </aside>

        <section aria-label="Games and insights" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <ViewTabs hrefFor={hrefFor} active={view} />
            <QueueTabs hrefFor={hrefFor} activeSlug={queueFilter.slug} />
          </div>

          {view === 'insights' ? (
            <InsightsPanel
              key={`${summoner.refreshed_at}-${queueFilter.slug}`}
              puuid={summoner.puuid}
              queueIds={queueFilter.queueIds}
              queueLabel={queueFilter.label}
              regionSlug={region.slug}
              {...lookups}
            />
          ) : history.length > 0 ? (
            <>
              <MatchList entries={history} gameData={gameData} regionSlug={region.slug} />
              {history.length >= shown && shown < maxShown ? (
                <div className="mt-4 flex justify-center">
                  <Link
                    href={hrefFor({ show: shown + pageSize })}
                    scroll={false}
                    className="border border-line-strong px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent"
                  >
                    Show more games
                  </Link>
                </div>
              ) : (
                shown < maxShown && <LoadMoreButton puuid={summoner.puuid} shown={history.length} />
              )}
            </>
          ) : (
            <EmptyHistory region={region} filterLabel={queueFilter.label} isFiltered={queueFilter.slug !== 'all'} />
          )}
        </section>
      </div>
    </div>
  )
}

/** Checks live status after the page shell is sent, so it never delays the profile. */
async function LiveStatusButton({ platform, puuid }: { platform: Platform; puuid: string }) {
  const status = await getLiveStatus(platform, puuid)
  return <LiveGameButton puuid={puuid} initialStatus={status} />
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

type View = 'matches' | 'insights'

interface PageState {
  queue: string
  view: View
  show: number
}

const pageSize = 20
const maxShown = 200

function clampShown(value: number): number {
  if (!Number.isFinite(value)) return pageSize
  return Math.min(maxShown, Math.max(pageSize, Math.round(value / pageSize) * pageSize))
}

/** Builds a summoner URL, leaving out defaults so links stay short. */
function buildHref(basePath: string, state: PageState): string {
  const params = new URLSearchParams()
  if (state.view !== 'matches') params.set('view', state.view)
  if (state.queue !== 'all') params.set('queue', state.queue)
  if (state.view === 'matches' && state.show !== pageSize) params.set('show', String(state.show))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function tabClass(isActive: boolean): string {
  return `border px-3 py-1 transition-colors ${
    isActive ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'
  }`
}

function ViewTabs({ hrefFor, active }: { hrefFor: (changes: Partial<PageState>) => string; active: View }) {
  const views: { view: View; label: string }[] = [
    { view: 'matches', label: 'Matches' },
    { view: 'insights', label: 'Insights' },
  ]
  return (
    <nav aria-label="Section" className="flex gap-5">
      {views.map(({ view, label }) => (
        <Link
          key={view}
          href={hrefFor({ view, show: pageSize })}
          aria-current={view === active ? 'page' : undefined}
          scroll={false}
          className={`border-b-2 pb-1 text-lg font-semibold transition-colors ${
            view === active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

function QueueTabs({ hrefFor, activeSlug }: { hrefFor: (changes: Partial<PageState>) => string; activeSlug: string }) {
  return (
    <nav aria-label="Filter by queue" className="flex flex-wrap gap-1 text-sm">
      {queueFilters.map((filter) => {
        const isActive = filter.slug === activeSlug
        return (
          <Link
            key={filter.slug}
            href={hrefFor({ queue: filter.slug, show: pageSize })}
            aria-current={isActive ? 'page' : undefined}
            scroll={false}
            className={tabClass(isActive)}
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
