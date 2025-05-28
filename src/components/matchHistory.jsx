import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import { RiotApiService } from '../database/riot-api-service.js'
import '../styles/matchHistory.css'

function MatchHistory({ summoner, onNavigate }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [matchCount, setMatchCount] = useState(20) // Start with 20 matches
  const [hasMoreMatches, setHasMoreMatches] = useState(true)

  useEffect(() => {
    if (summoner) {
      loadMatchHistory(20, true) // Reset to 20 matches when summoner changes
    }
  }, [summoner])

  const loadMatchHistory = async (count = 20, reset = false) => {
    if (!summoner || !summoner.puuid) {
      setError('No PUUID available for this summoner')
      setLoading(false)
      return
    }

    if (reset) {
      setLoading(true)
      setMatches([])
      setMatchCount(20)
    } else {
      setLoadingMore(true)
    }
    
    setError(null)

    try {
      console.log(`🔍 Loading ${count} matches for PUUID: ${summoner.puuid}`)
      
      // Step 1: Get match IDs using the working API format
      const matchIds = await RiotApiService.getMatchHistory(
        summoner.puuid, 
        summoner.region, 
        count,
        null, // startTime
        null, // endTime
        null  // queue filter
      )

      console.log(`✅ Retrieved ${matchIds.length} match IDs:`, matchIds)

      if (!matchIds || matchIds.length === 0) {
        setMatches([])
        setHasMoreMatches(false)
        setError('No matches found for this summoner')
        return
      }

      // Step 2: Get detailed match data for each match ID
      console.log('🔄 Fetching detailed match data...')
      const detailedMatches = []
      
      // Process matches in batches to avoid rate limiting
      const batchSize = 5
      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize)
        const batchPromises = batch.map(async (matchId) => {
          try {
            const matchDetail = await RiotApiService.getMatchDetails(matchId, summoner.region)
            
            // Find the current summoner's participant data
            const currentParticipant = matchDetail.info.participants.find(
              p => p.puuid === summoner.puuid
            )

            if (!currentParticipant) {
              console.warn(`❌ Current summoner not found in match ${matchId}`)
              return null
            }

            // Format the match data for our component
            const formattedMatch = {
              id: matchDetail.metadata.matchId,
              match_id: matchDetail.metadata.matchId,
              champion_name: currentParticipant.championName,
              kills: currentParticipant.kills,
              deaths: currentParticipant.deaths,
              assists: currentParticipant.assists,
              win: currentParticipant.win,
              game_duration: matchDetail.info.gameDuration,
              game_mode: matchDetail.info.gameMode,
              queue_id: matchDetail.info.queueId,
              created_at: new Date(matchDetail.info.gameCreation).toISOString(),
              cs: currentParticipant.totalMinionsKilled + currentParticipant.neutralMinionsKilled,
              gold: currentParticipant.goldEarned,
              damage_dealt: currentParticipant.totalDamageDealtToChampions,
              vision_score: currentParticipant.visionScore,
              items: [
                currentParticipant.item0,
                currentParticipant.item1,
                currentParticipant.item2,
                currentParticipant.item3,
                currentParticipant.item4,
                currentParticipant.item5,
                currentParticipant.item6
              ],
              spell1: currentParticipant.summoner1Id,
              spell2: currentParticipant.summoner2Id,
              champion_level: currentParticipant.champLevel,
              double_kills: currentParticipant.doubleKills,
              triple_kills: currentParticipant.tripleKills,
              quadra_kills: currentParticipant.quadraKills,
              penta_kills: currentParticipant.pentaKills,
              // Store full match data for detailed view
              matches: {
                match_id: matchDetail.metadata.matchId,
                game_creation: matchDetail.info.gameCreation,
                game_duration: matchDetail.info.gameDuration,
                game_mode: matchDetail.info.gameMode,
                queue_id: matchDetail.info.queueId,
                fullMatchData: matchDetail // Store full data for specific match view
              }
            }

            return formattedMatch
          } catch (matchError) {
            console.error(`❌ Error fetching match ${matchId}:`, matchError)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        const validMatches = batchResults.filter(match => match !== null)
        detailedMatches.push(...validMatches)

        // Small delay between batches to respect rate limits
        if (i + batchSize < matchIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      console.log(`✅ Successfully processed ${detailedMatches.length} matches`)

      // Sort matches by game creation time (newest first)
      detailedMatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      if (reset) {
        setMatches(detailedMatches)
      } else {
        setMatches(prev => [...prev, ...detailedMatches])
      }

      // Check if we can load more matches
      setHasMoreMatches(matchIds.length === count)
      
      if (detailedMatches.length > 0) {
        setError(`✅ Loaded ${detailedMatches.length} matches from Riot API`)
        setTimeout(() => setError(null), 3000)
      }

    } catch (err) {
      console.error('❌ Match history error:', err)
      
      if (err.message.includes('Rate limit')) {
        setError('⏱️ Rate limited. Please wait a moment before loading more matches.')
      } else if (err.message.includes('not found')) {
        setError('❌ No matches found for this summoner')
      } else {
        setError('⚠️ Failed to load match history. Showing demo data...')
        
        // Fallback to mock data if API fails
        const mockMatches = generateMockMatches(summoner)
        if (reset) {
          setMatches(mockMatches)
        }
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreMatches = async () => {
    if (!hasMoreMatches || loadingMore) return
    
    const newCount = matchCount + 20
    setMatchCount(newCount)
    await loadMatchHistory(newCount, false)
  }

  const generateMockMatches = (summoner) => {
    const champions = [
      'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Ammu', 'Anivia', 'Annie', 'Ashe',
      'Azir', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Caitlyn', 'Camille', 
      'Cassiopeia', 'Darius', 'Diana', 'Draven', 'Ekko', 'Elise', 'Ezreal'
    ]

    const gameModes = [
      { name: 'Ranked Solo/Duo', queue: 'RANKED_SOLO_5x5' },
      { name: 'Ranked Flex', queue: 'RANKED_FLEX_SR' },
      { name: 'Normal Draft', queue: 'NORMAL_DRAFT' },
      { name: 'ARAM', queue: 'ARAM' }
    ]

    return Array.from({ length: 10 }, (_, i) => {
      const win = Math.random() > 0.5
      const champion = champions[Math.floor(Math.random() * champions.length)]
      const gameMode = gameModes[Math.floor(Math.random() * gameModes.length)]
      const kills = Math.floor(Math.random() * 20)
      const deaths = Math.floor(Math.random() * 15)
      const assists = Math.floor(Math.random() * 25)
      const duration = Math.floor(Math.random() * 1800) + 900
      const createdAt = new Date(Date.now() - (i * Math.random() * 86400000 * 3))

      return {
        id: `mock_${i + 1}`,
        champion_name: champion,
        kills, deaths, assists, win,
        game_duration: duration,
        game_mode: gameMode.name,
        queue_id: gameMode.queue,
        created_at: createdAt.toISOString(),
        cs: Math.floor(Math.random() * 300) + 50,
        gold: Math.floor(Math.random() * 20000) + 5000,
        damage_dealt: Math.floor(Math.random() * 50000) + 10000,
        vision_score: Math.floor(Math.random() * 80) + 10,
        items: Array.from({ length: 6 }, () => Math.floor(Math.random() * 100) + 1),
        spell1: Math.floor(Math.random() * 14) + 1,
        spell2: Math.floor(Math.random() * 14) + 1
      }
    })
  }

  const filteredMatches = matches.filter(match => {
    if (selectedFilter === 'all') return true
    if (selectedFilter === 'wins') return match.win
    if (selectedFilter === 'losses') return !match.win
    if (selectedFilter === 'ranked') {
      return match.queue_id === 420 || match.queue_id === 440 // Ranked Solo or Flex
    }
    return true
  })

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return `${diffDays}d ago`
    }
  }

  const calculateKDA = (kills, deaths, assists) => {
    if (deaths === 0) return { value: 'Perfect', class: 'excellent' }
    const kda = ((kills + assists) / deaths)
    let kdaClass = 'average'
    
    if (kda >= 3) kdaClass = 'excellent'
    else if (kda >= 2) kdaClass = 'good'
    else if (kda < 1) kdaClass = 'poor'
    
    return { value: kda.toFixed(2), class: kdaClass }
  }

  const getQueueName = (queueId) => {
    const queueMap = {
      400: 'Normal Draft',
      420: 'Ranked Solo',
      430: 'Normal Blind',
      440: 'Ranked Flex',
      450: 'ARAM',
      700: 'Clash'
    }
    return queueMap[queueId] || 'Custom Game'
  }

  // Helper function to normalize champion names for image paths - UPDATED TO HANDLE CAPITALIZATION
  const getChampionImageName = (championName) => {
    if (!championName) return 'default'
    
    // Create a case-insensitive mapping for champion names
    const championNameMap = {
      // Existing mappings
      'cho\'gath': 'Chogath',
      'dr. mundo': 'DrMundo', 
      'jarvan iv': 'JarvanIV',
      'kai\'sa': 'Kaisa',
      'kha\'zix': 'Khazix',
      'kog\'maw': 'KogMaw',
      'lee sin': 'LeeSin',
      'master yi': 'MasterYi',
      'miss fortune': 'MissFortune',
      'nunu & willump': 'Nunu',
      'rek\'sai': 'RekSai',
      'renata glasc': 'Renata',
      'tahm kench': 'TahmKench',
      'twisted fate': 'TwistedFate',
      'vel\'koz': 'Velkoz',
      'wukong': 'MonkeyKing',
      'xin zhao': 'XinZhao',
      
      // Additional mappings for capitalization issues
      'fiddlesticks': 'Fiddlesticks',
      'leblanc': 'Leblanc',
      'belveth': 'Belveth',
      'chogath': 'Chogath',
      'drmundo': 'DrMundo',
      'jarvaniiv': 'JarvanIV',
      'kaisa': 'Kaisa',
      'khazix': 'Khazix',
      'kogmaw': 'KogMaw',
      'leesin': 'LeeSin',
      'masteryi': 'MasterYi',
      'missfortune': 'MissFortune',
      'reksai': 'RekSai',
      'tahmkench': 'TahmKench',
      'twistedfate': 'TwistedFate',
      'velkoz': 'Velkoz',
      'xinzhao': 'XinZhao'
    }

    // First try exact match (case-insensitive)
    const lowerChampionName = championName.toLowerCase()
    const mappedName = championNameMap[lowerChampionName]
    
    if (mappedName) {
      return mappedName
    }

    // If no mapping found, clean the name and preserve original capitalization
    // This handles most standard champion names properly
    const cleanedName = championName.replace(/[^a-zA-Z0-9]/g, '')
    
    // For names that are already in correct format, return as-is
    return cleanedName
  }

  // Helper function to get summoner spell image names
  const getSummonerSpellImageName = (spellId) => {
    const spellMap = {
      1: 'SummonerBoost',      // Cleanse
      3: 'SummonerExhaust',    // Exhaust  
      4: 'SummonerFlash',      // Flash
      6: 'SummonerHaste',      // Ghost
      7: 'SummonerHeal',       // Heal
      11: 'SummonerSmite',     // Smite
      12: 'SummonerTeleport',  // Teleport
      13: 'SummonerMana',      // Clarity
      14: 'SummonerDot',       // Ignite
      21: 'SummonerBarrier',   // Barrier
      30: 'SummonerPoroRecall', // To the King!
      31: 'SummonerPoroThrow', // Poro Toss
      32: 'SummonerSnowball'   // Mark/Dash
    }
    
    return spellMap[spellId] || 'SummonerFlash' // Default to Flash if unknown
  }

  const handleMatchClick = (match) => {
    onNavigate('specific-match', match)
  }

  if (!summoner) {
    return (
      <div className="match-history">
        <div className="error-state">
          <h2>No Summoner Selected</h2>
          <p>Please search for a summoner first.</p>
          <button onClick={() => onNavigate('search')}>
            Go to Search
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="match-history">
      <div className="match-header">
        <div className="summoner-info">
          <h1>{summoner.summoner_name}</h1>
          <p>Level {summoner.summoner_level} • {summoner.region.toUpperCase()}</p>
          {summoner.puuid && (
            <p className="puuid-info">PUUID: {summoner.puuid.substring(0, 16)}...</p>
          )}
        </div>
        <button 
          onClick={() => onNavigate('search')} 
          className="back-button"
        >
          ← Back to Search
        </button>
      </div>

      <div className="match-filters">
        <button 
          className={selectedFilter === 'all' ? 'active' : ''}
          onClick={() => setSelectedFilter('all')}
        >
          All Games ({matches.length})
        </button>
        <button 
          className={selectedFilter === 'wins' ? 'active' : ''}
          onClick={() => setSelectedFilter('wins')}
        >
          Wins ({matches.filter(m => m.win).length})
        </button>
        <button 
          className={selectedFilter === 'losses' ? 'active' : ''}
          onClick={() => setSelectedFilter('losses')}
        >
          Losses ({matches.filter(m => !m.win).length})
        </button>
        <button 
          className={selectedFilter === 'ranked' ? 'active' : ''}
          onClick={() => setSelectedFilter('ranked')}
        >
          Ranked ({matches.filter(m => m.queue_id === 420 || m.queue_id === 440).length})
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading match history from Riot API...</p>
        </div>
      )}

      {error && (
        <div className={`error-message ${error.includes('✅') ? 'success-message' : ''}`}>
          {error}
        </div>
      )}

      {!loading && filteredMatches.length === 0 && (
        <div className="empty-state">
          <h3>No matches found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      )}

      {!loading && filteredMatches.length > 0 && (
        <div className="matches-list">
          {filteredMatches.map(match => (
            <div 
              key={match.id} 
              className={`match-card ${match.win ? 'win' : 'loss'}`}
              onClick={() => handleMatchClick(match)}
            >
              <div className="match-result">
                <span className="result-text">{match.win ? 'Victory' : 'Defeat'}</span>
                <span className="time-ago">{formatTimeAgo(match.created_at)}</span>
              </div>

              <div className="match-info">
                <div className="game-mode">{getQueueName(match.queue_id)}</div>
                <div className="duration">{formatDuration(match.game_duration || 0)}</div>
              </div>

              <div className="champion-info">
                <div className="champion-image">
                  <img 
                    src={`/league_files/15.8.1/img/champion/${getChampionImageName(match.champion_name)}.png`}
                    alt={match.champion_name}
                    onError={(e) => {
                      // Try fallback paths
                      if (e.target.src.includes('15.8.1')) {
                        e.target.src = `/league_files/img/champion/${getChampionImageName(match.champion_name)}.png`
                      } else {
                        e.target.src = '/league_files/img/champion/default.png'
                      }
                    }}
                  />
                  {match.champion_level && (
                    <span className="champion-level">{match.champion_level}</span>
                  )}
                </div>
                <div className="champion-details">
                  <span className="champion-name">{match.champion_name}</span>
                  <div className="summoner-spells">
                    <img 
                      src={`/league_files/15.8.1/img/spell/${getSummonerSpellImageName(match.spell1)}.png`}
                      alt="Spell 1"
                      onError={(e) => {
                        // Try different spell image paths
                        if (e.target.src.includes('15.8.1')) {
                          e.target.src = `/league_files/img/spell/${getSummonerSpellImageName(match.spell1)}.png`
                        } else {
                          e.target.style.display = 'none'
                        }
                      }}
                    />
                    <img 
                      src={`/league_files/15.8.1/img/spell/${getSummonerSpellImageName(match.spell2)}.png`}
                      alt="Spell 2"
                      onError={(e) => {
                        // Try different spell image paths
                        if (e.target.src.includes('15.8.1')) {
                          e.target.src = `/league_files/img/spell/${getSummonerSpellImageName(match.spell2)}.png`
                        } else {
                          e.target.style.display = 'none'
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="match-stats">
                <div className="kda">
                  <span className="kda-text">{match.kills}/{match.deaths}/{match.assists}</span>
                  <span className={`kda-ratio ${calculateKDA(match.kills, match.deaths, match.assists).class}`}>
                    {calculateKDA(match.kills, match.deaths, match.assists).value} KDA
                  </span>
                  {(match.double_kills > 0 || match.triple_kills > 0 || match.quadra_kills > 0 || match.penta_kills > 0) && (
                    <div className="multikills">
                      {match.penta_kills > 0 && <span className="penta">PENTA!</span>}
                      {match.quadra_kills > 0 && <span className="quadra">QUADRA!</span>}
                      {match.triple_kills > 0 && <span className="triple">TRIPLE!</span>}
                      {match.double_kills > 0 && <span className="double">DOUBLE!</span>}
                    </div>
                  )}
                </div>
                <div className="additional-stats">
                  <span>CS: {match.cs || 0}</span>
                  <span>Vision: {match.vision_score || 0}</span>
                  {match.gold && <span>Gold: {Math.round(match.gold / 1000)}k</span>}
                </div>
              </div>

              <div className="items">
                {(match.items || []).slice(0, 6).map((item, index) => (
                  <div key={index} className="item-slot">
                    {item > 0 && (
                      <img 
                        src={`/league_files/15.8.1/img/item/${item}.png`}
                        alt={`Item ${item}`}
                        onError={(e) => {
                          // Try fallback item image path
                          if (e.target.src.includes('15.8.1')) {
                            e.target.src = `/league_files/img/item/${item}.png`
                          } else {
                            e.target.style.display = 'none'
                          }
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="view-details">
                <span>Click for details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && matches.length > 0 && hasMoreMatches && (
        <div className="load-more-section">
          <button 
            onClick={loadMoreMatches}
            disabled={loadingMore}
            className="load-more-btn"
          >
            {loadingMore ? (
              <>
                <div className="loading-spinner small"></div>
                Loading more matches...
              </>
            ) : (
              `Load More Matches (${matchCount} → ${matchCount + 20})`
            )}
          </button>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div className="match-actions">
          <button onClick={() => onNavigate('player-stats', summoner)}>
            View Player Statistics
          </button>
          <button onClick={() => onNavigate('search')}>
            Search Another Player
          </button>
        </div>
      )}
    </div>
  )
}

export default MatchHistory