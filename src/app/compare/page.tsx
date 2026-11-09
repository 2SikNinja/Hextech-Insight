import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { type ComparePlayerInput, CompareForm } from '@/components/CompareForm'
import { CompareStats } from '@/components/CompareStats'
import { GameImage } from '@/components/GameImage'
import { getGameData, profileIconUrl } from '@/lib/ddragon'
import { describeError } from '@/lib/errors'
import { formatTier } from '@/lib/format'
import { type Region, getRegionBySlug } from '@/lib/riot/regions'
import { type RiotId, formatRiotId, parseRiotIdSlug, summonerPath } from '@/lib/riot/riotId'
import { type SummonerRecord, lookupSummoner } from '@/lib/summoners'

export const metadata: Metadata = {
  title: 'Compare players',
  description: 'Compare two League of Legends players side by side.',
}

interface PlayerRef {
  region: Region
  riotId: RiotId
}

/** Reads "na/Name-TAG" from the query string. */
function parsePlayerParam(value: string | string[] | undefined): PlayerRef | null {
  if (typeof value !== 'string') return null
  const slashIndex = value.indexOf('/')
  if (slashIndex <= 0) return null
  const region = getRegionBySlug(value.slice(0, slashIndex))
  const riotId = parseRiotIdSlug(value.slice(slashIndex + 1))
  return region && riotId ? { region, riotId } : null
}

function toFormInput(player: PlayerRef | null): ComparePlayerInput | null {
  return player ? { regionSlug: player.region.slug, riotIdText: formatRiotId(player.riotId) } : null
}

export default function ComparePage(props: PageProps<'/compare'>) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl text-ink">Compare players</h1>
      <p className="mt-2 text-muted">See two players&apos; recent stats side by side.</p>
      <Suspense fallback={<div className="mt-8 h-24 animate-pulse bg-surface" />}>
        <CompareView {...props} />
      </Suspense>
    </div>
  )
}

type Side = { ok: true; summoner: SummonerRecord; region: Region } | { ok: false; title: string; message: string }

async function loadSide(player: PlayerRef): Promise<Side> {
  try {
    const { summoner } = await lookupSummoner(player.region, player.riotId)
    return { ok: true, summoner, region: player.region }
  } catch (error) {
    const friendly = describeError(error, {
      notFound: `No player named ${formatRiotId(player.riotId)} plays on ${player.region.label}.`,
    })
    return { ok: false, ...friendly }
  }
}

async function CompareView({ searchParams }: PageProps<'/compare'>) {
  const query = await searchParams
  const players = [parsePlayerParam(query.a), parsePlayerParam(query.b)] as const

  const form = <CompareForm key={`${query.a}-${query.b}`} initial={[toFormInput(players[0]), toFormInput(players[1])]} />
  if (!players[0] || !players[1]) return <div className="mt-8">{form}</div>

  // One at a time, so a rate-limit refusal for the first does not spend budget on the second.
  const first = await loadSide(players[0])
  const second = await loadSide(players[1])
  const gameData = await getGameData()
  const sides = [first, second]

  return (
    <div className="mt-8 flex flex-col gap-6">
      {form}

      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((side, index) =>
          side.ok ? (
            <Link
              key={index}
              href={summonerPath(side.region.slug, { gameName: side.summoner.game_name, tagLine: side.summoner.tag_line })}
              className="flex items-center gap-4 border border-line bg-surface p-4 transition-colors hover:border-accent"
            >
              <GameImage src={profileIconUrl(gameData, side.summoner.profile_icon_id)} alt="" size={56} />
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-ink">
                  {side.summoner.game_name}
                  <span className="ml-1 font-normal text-muted">#{side.summoner.tag_line}</span>
                </span>
                <span className="block text-sm text-muted">
                  {side.region.shortLabel}
                  <span className="ml-3">{formatTier(side.summoner.solo_tier, side.summoner.solo_division)}</span>
                </span>
              </span>
            </Link>
          ) : (
            <div key={index} className="border border-line bg-surface p-4">
              <p className="font-semibold text-loss">{side.title}</p>
              <p className="mt-1 text-sm text-muted">{side.message}</p>
            </div>
          ),
        )}
      </div>

      {first.ok && second.ok && (
        <CompareStats
          puuids={[first.summoner.puuid, second.summoner.puuid]}
          names={[first.summoner.game_name, second.summoner.game_name]}
        />
      )}
    </div>
  )
}
