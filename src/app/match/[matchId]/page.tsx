import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { GameImage } from '@/components/GameImage'
import { PageMessage } from '@/components/PageMessage'
import {
  type GameData,
  championIconUrl,
  championName,
  getGameData,
  itemIconUrl,
  itemName,
  runeIconUrl,
  runeName,
  spellIconUrl,
  spellName,
} from '@/lib/ddragon'
import { describeError } from '@/lib/errors'
import { formatCompact, formatDate, formatDuration, formatKdaRatio, formatPatch, formatPerMinute } from '@/lib/format'
import { getMatchDetail } from '@/lib/matches'
import { getQueueName } from '@/lib/riot/queues'
import { type Region, getRegionFromMatchId, isValidMatchId } from '@/lib/riot/regions'
import { summonerPath } from '@/lib/riot/riotId'
import type { RiotMatch, RiotParticipant, RiotTeam } from '@/lib/riot/schemas'
import {
  getDurationSeconds,
  getGameStart,
  getParticipantItems,
  getRiotIdParts,
  getTeamKey,
} from '@/lib/riot/transform'

type MatchPageProps = PageProps<'/match/[matchId]'>

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { matchId } = await params
  return { title: `Match ${matchId}` }
}

export default function MatchPage(props: MatchPageProps) {
  return (
    <Suspense fallback={<MatchSkeleton />}>
      <MatchView {...props} />
    </Suspense>
  )
}

async function MatchView({ params, searchParams }: MatchPageProps) {
  const [{ matchId }, query] = await Promise.all([params, searchParams])
  const region = getRegionFromMatchId(matchId)
  if (!isValidMatchId(matchId) || !region) notFound()

  const focusPuuid = typeof query.player === 'string' ? query.player : null

  let match: RiotMatch | null
  try {
    match = await getMatchDetail(matchId)
  } catch (error) {
    const friendly = describeError(error, { notFound: 'This match could not be found.' })
    return (
      <PageMessage title={friendly.title} tone="error">
        <p>{friendly.message}</p>
      </PageMessage>
    )
  }
  if (!match) notFound()

  const gameData = await getGameData()
  const duration = getDurationSeconds(match)
  const teams = groupTeams(match)
  const maxDamage = Math.max(1, ...match.info.participants.map((participant) => participant.totalDamageDealtToChampions))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="border-b border-line pb-5">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">
          {getQueueName(match.info.queueId, match.info.gameMode)}
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted">Played</dt>
            <dd className="text-text">
              <time dateTime={getGameStart(match).toISOString()}>{formatDate(getGameStart(match).toISOString())}</time>
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Length</dt>
            <dd className="tabular text-text">{formatDuration(duration)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Patch</dt>
            <dd className="tabular text-text">{formatPatch(match.info.gameVersion)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Region</dt>
            <dd className="text-text">{region.label}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        {teams.map((team) => (
          <TeamTable
            key={team.key}
            team={team}
            gameData={gameData}
            region={region}
            duration={duration}
            maxDamage={maxDamage}
            focusPuuid={focusPuuid}
          />
        ))}
      </div>
    </div>
  )
}

interface TeamGroup {
  key: number
  win: boolean
  placement: number | null
  players: RiotParticipant[]
  info: RiotTeam | null
}

/** Groups players by team (or by Arena subteam, ordered by placement). */
function groupTeams(match: RiotMatch): TeamGroup[] {
  const groups = new Map<number, TeamGroup>()
  for (const participant of match.info.participants) {
    const key = getTeamKey(participant)
    const group = groups.get(key) ?? {
      key,
      win: participant.win,
      placement: participant.placement && participant.placement > 0 ? participant.placement : null,
      players: [],
      info: match.info.teams.find((team) => team.teamId === key) ?? null,
    }
    group.players.push(participant)
    groups.set(key, group)
  }

  return [...groups.values()].sort((first, second) => {
    if (first.placement !== null && second.placement !== null) return first.placement - second.placement
    return first.key - second.key
  })
}

function teamLabel(team: TeamGroup): string {
  if (team.placement !== null) return `Placed ${team.placement}`
  if (team.key === 100) return 'Blue side'
  if (team.key === 200) return 'Red side'
  return `Team ${team.key}`
}

function TeamTable({
  team,
  gameData,
  region,
  duration,
  maxDamage,
  focusPuuid,
}: {
  team: TeamGroup
  gameData: GameData
  region: Region
  duration: number
  maxDamage: number
  focusPuuid: string | null
}) {
  const kills = team.players.reduce((total, player) => total + player.kills, 0)
  const teamGold = team.players.reduce((total, player) => total + player.goldEarned, 0)
  const objectives = team.info?.objectives
  const resultColor = team.win ? 'text-win' : 'text-loss'
  const edgeColor = team.win ? 'border-win' : 'border-loss'

  return (
    <section aria-label={`${teamLabel(team)}, ${team.win ? 'victory' : 'defeat'}`} className={`border-t-2 ${edgeColor} bg-surface`}>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3">
        <h2 className={`text-lg font-semibold ${resultColor}`}>{team.win ? 'Victory' : 'Defeat'}</h2>
        <span className="text-sm text-muted">{teamLabel(team)}</span>
        <dl className="tabular ml-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <TeamStat label="Kills" value={kills} />
          <TeamStat label="Gold" value={formatCompact(teamGold)} />
          {objectives?.tower && <TeamStat label="Towers" value={objectives.tower.kills} />}
          {objectives?.dragon && <TeamStat label="Dragons" value={objectives.dragon.kills} />}
          {objectives?.baron && <TeamStat label="Barons" value={objectives.baron.kills} />}
          {objectives?.horde && <TeamStat label="Grubs" value={objectives.horde.kills} />}
        </dl>
        {team.info && team.info.bans.some((ban) => ban.championId > 0) && (
          <div className="flex items-center gap-1" aria-label="Bans">
            <span className="mr-1 text-sm text-muted">Bans</span>
            {team.info.bans
              .filter((ban) => ban.championId > 0)
              .map((ban, index) => (
                <GameImage
                  key={index}
                  src={championIconUrl(gameData, ban.championId)}
                  alt={`Banned ${championName(gameData, ban.championId)}`}
                  size={20}
                  className="opacity-60 grayscale"
                />
              ))}
          </div>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[56rem] text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2 font-normal">Player</th>
              <th scope="col" className="px-2 py-2 font-normal">KDA</th>
              <th scope="col" className="px-2 py-2 font-normal">Damage</th>
              <th scope="col" className="px-2 py-2 font-normal">Gold</th>
              <th scope="col" className="px-2 py-2 font-normal">CS</th>
              <th scope="col" className="px-2 py-2 font-normal">Vision</th>
              <th scope="col" className="px-4 py-2 font-normal">Items</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((player) => (
              <PlayerRow
                key={player.puuid}
                player={player}
                gameData={gameData}
                region={region}
                duration={duration}
                maxDamage={maxDamage}
                isFocus={player.puuid === focusPuuid}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TeamStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

function PlayerRow({
  player,
  gameData,
  region,
  duration,
  maxDamage,
  isFocus,
}: {
  player: RiotParticipant
  gameData: GameData
  region: Region
  duration: number
  maxDamage: number
  isFocus: boolean
}) {
  const { gameName, tagLine } = getRiotIdParts(player)
  const champion = championName(gameData, player.championId, player.championName)
  const [primaryStyle, secondaryStyle] = player.perks?.styles ?? []
  const keystone = primaryStyle?.selections[0]?.perk ?? null
  const cs = player.totalMinionsKilled + player.neutralMinionsKilled

  return (
    <tr className={`border-b border-line/60 last:border-b-0 ${isFocus ? 'bg-accent/10' : ''}`}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <GameImage src={championIconUrl(gameData, player.championId, player.championName)} alt={champion} size={36} />
            <span className="absolute -bottom-1 -right-1 bg-canvas px-0.5 text-[10px] text-ink ring-1 ring-line">
              {player.champLevel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <GameImage src={spellIconUrl(gameData, player.summoner1Id)} alt={spellName(gameData, player.summoner1Id)} size={17} />
            <GameImage src={spellIconUrl(gameData, player.summoner2Id)} alt={spellName(gameData, player.summoner2Id)} size={17} />
          </div>
          <div className="flex flex-col gap-0.5">
            <GameImage src={runeIconUrl(gameData, keystone)} alt={runeName(gameData, keystone)} size={17} rounded />
            <GameImage
              src={runeIconUrl(gameData, secondaryStyle?.style ?? null)}
              alt={runeName(gameData, secondaryStyle?.style ?? null)}
              size={17}
              rounded
            />
          </div>
          <div className="min-w-0 pl-1">
            {gameName && tagLine ? (
              <Link
                href={summonerPath(region.slug, { gameName, tagLine })}
                className={`block max-w-40 truncate hover:text-accent ${isFocus ? 'font-semibold text-ink' : 'text-text'}`}
              >
                {gameName}
              </Link>
            ) : (
              <span className="block max-w-40 truncate text-text">{gameName ?? 'Unknown'}</span>
            )}
            <span className="block text-xs text-muted">{champion}</span>
          </div>
        </div>
      </td>
      <td className="px-2 py-2">
        <span className="text-ink">
          {player.kills}/{player.deaths}/{player.assists}
        </span>
        <span className="block text-xs text-muted">{formatKdaRatio(player.kills, player.deaths, player.assists)}</span>
      </td>
      <td className="w-36 px-2 py-2">
        <span className="text-text">{player.totalDamageDealtToChampions.toLocaleString('en-US')}</span>
        <div className="mt-1 h-1.5 bg-canvas" aria-hidden>
          <div
            className="h-full bg-loss/80"
            style={{ width: `${(player.totalDamageDealtToChampions / maxDamage) * 100}%` }}
          />
        </div>
      </td>
      <td className="px-2 py-2 text-text">{formatCompact(player.goldEarned)}</td>
      <td className="px-2 py-2">
        <span className="text-text">{cs}</span>
        <span className="block text-xs text-muted">{formatPerMinute(cs, duration)}/min</span>
      </td>
      <td className="px-2 py-2 text-text">{player.visionScore}</td>
      <td className="px-4 py-2">
        <div className="flex gap-0.5">
          {getParticipantItems(player).map((itemId, slot) => (
            <GameImage key={slot} src={itemIconUrl(gameData, itemId)} alt={itemId ? itemName(gameData, itemId) : ''} size={24} />
          ))}
        </div>
      </td>
    </tr>
  )
}

function MatchSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-label="Loading match">
      <div className="h-9 w-64 animate-pulse bg-surface-muted" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse bg-surface-muted" />
      <div className="mt-8 h-72 animate-pulse bg-surface" />
      <div className="mt-6 h-72 animate-pulse bg-surface" />
    </div>
  )
}
