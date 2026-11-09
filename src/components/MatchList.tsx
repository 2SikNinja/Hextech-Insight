import Link from 'next/link'
import { GameImage } from '@/components/GameImage'
import {
  type GameData,
  championIconUrl,
  championName,
  itemIconUrl,
  itemName,
  runeIconUrl,
  runeName,
  spellIconUrl,
  spellName,
} from '@/lib/ddragon'
import {
  formatDuration,
  formatKdaRatio,
  formatPercent,
  formatPerMinute,
  formatTimeAgo,
  positionLabels,
} from '@/lib/format'
import type { HistoryEntry, RosterEntry } from '@/lib/matches'
import { getQueueName } from '@/lib/riot/queues'
import { summonerPath } from '@/lib/riot/riotId'

interface MatchListProps {
  entries: HistoryEntry[]
  gameData: GameData
  regionSlug: string
}

export function MatchList({ entries, gameData, regionSlug }: MatchListProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li key={entry.player.match_id}>
          <MatchRow entry={entry} gameData={gameData} regionSlug={regionSlug} />
        </li>
      ))}
    </ol>
  )
}

function resultStyle(win: boolean, remake: boolean) {
  if (remake) return { label: 'Remake', edge: 'bg-line-strong', wash: 'bg-surface', text: 'text-muted' }
  return win
    ? { label: 'Victory', edge: 'bg-win', wash: 'bg-win-wash', text: 'text-win' }
    : { label: 'Defeat', edge: 'bg-loss', wash: 'bg-loss-wash', text: 'text-loss' }
}

function multikillLabel(entry: HistoryEntry['player']): string | null {
  if (entry.penta_kills > 0) return 'Penta kill'
  if (entry.quadra_kills > 0) return 'Quadra kill'
  if (entry.triple_kills > 0) return 'Triple kill'
  return null
}

function MatchRow({ entry, gameData, regionSlug }: { entry: HistoryEntry; gameData: GameData; regionSlug: string }) {
  const { player, roster } = entry
  const result = resultStyle(player.win, player.remake)
  const champion = championName(gameData, player.champion_id, player.champion_name)
  const multikill = multikillLabel(player)
  const showRoster = roster.length > 0 && roster.length <= 10

  return (
    <article
      className={`relative grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 py-3 pl-5 pr-3 sm:grid-cols-[6rem_auto_1fr_6rem] lg:grid-cols-[6rem_auto_1fr_6rem_auto_auto] ${result.wash}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${result.edge}`} />

      {/* Queue, result, timing */}
      <div className="col-span-2 flex flex-wrap items-baseline gap-x-3 text-sm sm:col-span-1 sm:block">
        <p className="font-semibold text-ink">{getQueueName(player.queue_id)}</p>
        <p className={`font-semibold ${result.text}`}>{result.label}</p>
        <p className="tabular text-muted">{formatDuration(player.duration_secs)}</p>
        <p className="text-muted">
          <time dateTime={player.game_start}>{formatTimeAgo(player.game_start)}</time>
        </p>
      </div>

      {/* Champion, spells, runes */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <GameImage src={championIconUrl(gameData, player.champion_id, player.champion_name)} alt={champion} size={48} />
          <span className="tabular absolute -bottom-1 -right-1 bg-canvas px-1 text-xs text-ink ring-1 ring-line">
            {player.champion_level}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <GameImage src={spellIconUrl(gameData, player.summoner_spell_1)} alt={spellName(gameData, player.summoner_spell_1)} size={22} />
          <GameImage src={spellIconUrl(gameData, player.summoner_spell_2)} alt={spellName(gameData, player.summoner_spell_2)} size={22} />
        </div>
        <div className="flex flex-col gap-1">
          <GameImage src={runeIconUrl(gameData, player.primary_rune)} alt={runeName(gameData, player.primary_rune)} size={22} rounded />
          <GameImage src={runeIconUrl(gameData, player.secondary_style)} alt={runeName(gameData, player.secondary_style)} size={22} rounded className="p-0.5" />
        </div>
      </div>

      {/* KDA with the final build underneath */}
      <div className="min-w-0">
        <p className="tabular text-lg font-semibold leading-tight text-ink">
          {player.kills} <span className="text-muted">/</span> {player.deaths}{' '}
          <span className="text-muted">/</span> {player.assists}
          <span className="ml-2 text-sm font-normal text-muted">
            {formatKdaRatio(player.kills, player.deaths, player.assists)} KDA
          </span>
        </p>
        {multikill && <p className="text-xs font-semibold text-accent">{multikill}</p>}
        <ul className="mt-1.5 flex gap-0.5" aria-label="Items">
          {player.items.map((itemId, slot) => (
            <li key={slot} className={slot === 6 ? 'ml-1' : undefined}>
              <GameImage src={itemIconUrl(gameData, itemId)} alt={itemId ? itemName(gameData, itemId) : ''} size={24} />
            </li>
          ))}
        </ul>
      </div>

      {/* Farming and participation */}
      <dl className="tabular col-span-2 flex gap-x-4 text-sm sm:col-span-1 sm:grid sm:grid-cols-[auto_1fr] sm:gap-x-2">
        <div className="flex gap-1.5 sm:contents">
          <dt className="text-muted">CS</dt>
          <dd className="text-text">
            {player.cs} ({formatPerMinute(player.cs, player.duration_secs)})
          </dd>
        </div>
        <div className="flex gap-1.5 sm:contents">
          <dt className="text-muted">KP</dt>
          <dd className="text-text">{formatPercent(player.kill_participation)}</dd>
        </div>
        <div className="flex gap-1.5 sm:contents">
          <dt className="text-muted">Role</dt>
          <dd className="text-text">{positionLabels[player.team_position] ?? 'None'}</dd>
        </div>
      </dl>

      {showRoster ? (
        <Roster roster={roster} focusPuuid={player.puuid} gameData={gameData} regionSlug={regionSlug} />
      ) : (
        <span className="hidden lg:block" />
      )}

      <Link
        href={`/match/${player.match_id}?player=${encodeURIComponent(player.puuid)}`}
        className="col-span-2 justify-self-start text-sm font-semibold text-accent hover:text-ink sm:col-span-4 lg:col-span-1 lg:justify-self-end lg:self-stretch lg:border-l lg:border-line/70 lg:pl-3"
      >
        <span className="flex h-full items-center">Details</span>
      </Link>
    </article>
  )
}

function Roster({
  roster,
  focusPuuid,
  gameData,
  regionSlug,
}: {
  roster: RosterEntry[]
  focusPuuid: string
  gameData: GameData
  regionSlug: string
}) {
  const teamIds = [...new Set(roster.map((entry) => entry.team_id))]

  return (
    <div className="hidden flex-col gap-1 lg:flex" aria-label="Players in this game">
      {teamIds.map((teamId) => (
        <ul key={teamId} className="flex gap-0.5">
          {roster
            .filter((entry) => entry.team_id === teamId)
            .map((entry) => {
              const label = `${entry.riot_id_name ?? 'Unknown'} (${championName(gameData, entry.champion_id, entry.champion_name)})`
              const icon = (
                <GameImage
                  src={championIconUrl(gameData, entry.champion_id, entry.champion_name)}
                  alt={label}
                  size={20}
                  className={entry.puuid === focusPuuid ? 'ring-2 ring-accent' : 'opacity-80 hover:opacity-100'}
                />
              )
              return (
                <li key={entry.puuid}>
                  {entry.riot_id_name && entry.riot_id_tag && entry.puuid !== focusPuuid ? (
                    <Link href={summonerPath(regionSlug, { gameName: entry.riot_id_name, tagLine: entry.riot_id_tag })}>
                      {icon}
                    </Link>
                  ) : (
                    icon
                  )}
                </li>
              )
            })}
        </ul>
      ))}
    </div>
  )
}
