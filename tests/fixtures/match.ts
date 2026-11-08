// A trimmed but realistic Match-V5 payload used by the unit tests.

function participant(index: number, overrides: Record<string, unknown> = {}) {
  const teamId = index < 5 ? 100 : 200
  const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
  return {
    puuid: `puuid-${index}`,
    participantId: index + 1,
    riotIdGameName: `Player${index}`,
    riotIdTagline: 'NA1',
    teamId,
    teamPosition: positions[index % 5],
    championId: 100 + index,
    championName: `Champion${index}`,
    champLevel: 16,
    win: teamId === 100,
    gameEndedInEarlySurrender: false,
    kills: 2,
    deaths: 3,
    assists: 4,
    totalMinionsKilled: 150,
    neutralMinionsKilled: 10,
    goldEarned: 11000,
    totalDamageDealtToChampions: 20000,
    totalDamageTaken: 18000,
    visionScore: 25,
    summoner1Id: 4,
    summoner2Id: 14,
    item0: 3031,
    item1: 3006,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 3340,
    perks: {
      styles: [
        { style: 8000, selections: [{ perk: 8005 }, { perk: 9111 }] },
        { style: 8300, selections: [{ perk: 8345 }] },
      ],
    },
    doubleKills: 0,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    playerSubteamId: 0,
    // Extra fields Riot sends that our schema should ignore.
    unrealKills: 0,
    challenges: { kda: 2 },
    ...overrides,
  }
}

export function buildMatchPayload() {
  const participants = Array.from({ length: 10 }, (_, index) => participant(index))
  participants[0] = participant(0, { kills: 10, deaths: 0, assists: 5, doubleKills: 2, pentaKills: 1 })

  return {
    metadata: { dataVersion: '2', matchId: 'NA1_5012345678', participants: participants.map((p) => p.puuid) },
    info: {
      gameCreation: 1_762_000_000_000,
      gameStartTimestamp: 1_762_000_060_000,
      gameEndTimestamp: 1_762_001_860_000,
      gameDuration: 1800,
      gameMode: 'CLASSIC',
      gameVersion: '15.21.715.1234',
      platformId: 'NA1',
      queueId: 420,
      participants,
      teams: [
        { teamId: 100, win: true, bans: [{ championId: 1, pickTurn: 1 }], objectives: { tower: { first: true, kills: 9 } } },
        { teamId: 200, win: false, bans: [], objectives: { tower: { first: false, kills: 2 } } },
      ],
    },
  }
}
