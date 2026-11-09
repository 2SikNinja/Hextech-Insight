import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { GameImage } from '@/components/GameImage'
import { InsightsPanel } from '@/components/InsightsPanel'
import { MatchList } from '@/components/MatchList'
import { PageMessage } from '@/components/PageMessage'
import { StatsPanel } from '@/components/StatsPanel'
import { commonFinalItems } from '@/lib/commonItems'
import {
  type GameData,
  championIconUrl,
  championName,
  championSplashUrl,
  getGameData,
  itemIconUrl,
  itemName,
} from '@/lib/ddragon'
import { describeError } from '@/lib/errors'
import { formatPercent } from '@/lib/format'
import { getMatchHistory } from '@/lib/matches'
import { getRegionBySlug } from '@/lib/riot/regions'
import { formatRiotId, parseRiotIdSlug, summonerPath } from '@/lib/riot/riotId'
import { type LookupResult, lookupSummoner } from '@/lib/summoners'

type ChampionPageProps = PageProps<'/summoner/[region]/[riotId]/champion/[championId]'>

const gamesShown = 50

export async function generateMetadata({ params }: ChampionPageProps): Promise<Metadata> {
  const { riotId: riotIdSlug, championId } = await params
  const riotId = parseRiotIdSlug(riotIdSlug)
  const gameData = await getGameData().catch(() => null)
  const name = gameData ? championName(gameData, Number(championId)) : 'Champion'
  return { title: riotId ? `${formatRiotId(riotId)} on ${name}` : name }
}

export default function ChampionPage(props: ChampionPageProps) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse bg-surface" />}>
      <ChampionView {...props} />
    </Suspense>
  )
}

async function ChampionView({ params }: ChampionPageProps) {
  const { region: regionSlug, riotId: riotIdSlug, championId: championIdText } = await params
  const region = getRegionBySlug(regionSlug)
  const riotId = parseRiotIdSlug(riotIdSlug)
  const championId = Number(championIdText)
  if (!region || !riotId || !Number.isInteger(championId) || championId <= 0) notFound()

  let lookup: LookupResult
  try {
    lookup = await lookupSummoner(region, riotId)
  } catch (error) {
    const friendly = describeError(error, { notFound: `No player named ${formatRiotId(riotId)} plays on ${region.label}.` })
    return (
      <PageMessage title={friendly.title} tone="error">
        <p>{friendly.message}</p>
      </PageMessage>
    )
  }

  const { summoner } = lookup
  const [gameData, games] = await Promise.all([
    getGameData(),
    getMatchHistory(summoner.puuid, { queueIds: [], limit: gamesShown, championId }),
  ])
  const name = championName(gameData, championId)
  const profilePath = summonerPath(region.slug, { gameName: summoner.game_name, tagLine: summoner.tag_line })
  const splash = championSplashUrl(gameData, championId)
  const items = commonFinalItems(games.map((game) => game.player.items))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="relative overflow-hidden border border-line bg-surface">
        {splash && (
          // Decorative splash art behind the header, faded so text stays readable.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={splash} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%] opacity-25" />
        )}
        <div className="relative flex flex-wrap items-center gap-5 bg-gradient-to-r from-surface via-surface/85 to-transparent px-5 py-6">
          <GameImage src={championIconUrl(gameData, championId)} alt="" size={72} className="ring-1 ring-line-strong" />
          <div>
            <p className="text-sm text-muted">
              <Link href={profilePath} className="hover:text-accent">
                {summoner.game_name}
                <span className="ml-1">#{summoner.tag_line}</span>
              </Link>
            </p>
            <h1 className="font-display text-3xl text-ink">{name}</h1>
            <p className="text-sm text-muted">
              {games.length === 0
                ? 'No stored games on this champion yet.'
                : `${games.length} stored ${games.length === 1 ? 'game' : 'games'}${games.length === gamesShown ? ' (latest shown)' : ''}`}
            </p>
          </div>
        </div>
      </header>

      {games.length === 0 ? (
        <p className="mt-6 border border-line bg-surface px-5 py-8 text-sm text-muted">
          Nothing to show for {name} yet. Load older games on the{' '}
          <Link href={profilePath} className="text-accent hover:text-ink">
            profile
          </Link>{' '}
          to find more.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="flex flex-col gap-6">
            <StatsPanel puuid={summoner.puuid} queueIds={[]} queueLabel="All" championId={championId} championIcons={{}} championNames={{}} />
            <CommonItems items={items} gameData={gameData} />
          </aside>
          <div className="flex min-w-0 flex-col gap-6">
            <InsightsPanel
              puuid={summoner.puuid}
              queueIds={[]}
              championId={championId}
              queueLabel="All"
              regionSlug={region.slug}
              {...championLookups(gameData)}
            />
            <section aria-labelledby="champion-games-heading">
              <h2 id="champion-games-heading" className="mb-3 text-lg font-semibold text-ink">
                Games on {name}
              </h2>
              <MatchList entries={games} gameData={gameData} regionSlug={region.slug} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function CommonItems({ items, gameData }: { items: ReturnType<typeof commonFinalItems>; gameData: GameData }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="items-heading" className="border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 id="items-heading" className="font-semibold text-ink">
          Most built items
        </h2>
        <p className="text-sm text-muted">Share of games finished with each item</p>
      </header>
      <ul className="divide-y divide-line/60 px-4">
        {items.map((item) => (
          <li key={item.itemId} className="flex items-center gap-3 py-2">
            <GameImage src={itemIconUrl(gameData, item.itemId)} alt="" size={28} />
            <span className="min-w-0 flex-1 truncate text-sm text-text">{itemName(gameData, item.itemId)}</span>
            <span className="tabular text-sm text-muted">{formatPercent(item.share)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function championLookups(gameData: GameData) {
  const championIcons: Record<string, string> = {}
  const championNames: Record<string, string> = {}
  for (const [id, champion] of Object.entries(gameData.champions)) {
    championIcons[id] = championIconUrl(gameData, Number(id))
    championNames[id] = champion.name
  }
  return { championIcons, championNames }
}
