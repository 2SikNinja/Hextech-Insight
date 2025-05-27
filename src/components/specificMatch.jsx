import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/specificMatch.css'

function SpecificMatch({ match, onNavigate }) {
  const [matchDetails, setMatchDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState('all') // 'all', 'blue', 'red'
  const [selectedTab, setSelectedTab] = useState('overview') // 'overview', 'builds', 'timeline'

  useEffect(() => {
    if (match) {
      loadMatchDetails()
    }
  }, [match])

  const loadMatchDetails = async () => {
    if (!match?.matches?.match_id) {
      // If we don't have a full match ID, create mock detailed data
      setMatchDetails(generateDetailedMatchData(match))
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: dbError } = await DatabaseService.getSpecificMatch(match.matches.match_id)
      
      if (data) {
        setMatchDetails(data)
      } else {
        // Fallback to mock data if not found in database
        setMatchDetails(generateDetailedMatchData(match))
      }
    } catch (err) {
      console.error('Error loading match details:', err)
      setError('Failed to load match details')
      // Still show mock data on error
      setMatchDetails(generateDetailedMatchData(match))
    } finally {
      setLoading(false)
    }
  }

  const generateDetailedMatchData = (matchData) => {
    const champions = [
      'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Amumu', 'Anivia', 'Annie', 'Ashe',
      'Azir', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Caitlyn', 'Camille', 
      'Cassiopeia', 'Darius', 'Diana', 'Draven', 'Ekko', 'Elise', 'Ezreal',
      'Fiora', 'Fizz', 'Garen', 'Graves', 'Irelia', 'Janna', 'Jarvan IV',
      'Jax', 'Jinx', 'Karma', 'Katarina', 'Kayle', 'Leblanc', 'Lee Sin',
      'Leona', 'Lux', 'Malphite', 'Morgana', 'Nasus', 'Orianna', 'Riven',
      'Ryze', 'Shaco', 'Shen', 'Sivir', 'Sona', 'Thresh', 'Tristana',
      'Twisted Fate', 'Twitch', 'Vayne', 'Veigar', 'Vi', 'Viktor', 'Vladimir',
      'Warwick', 'Xin Zhao', 'Yasuo', 'Yorick', 'Zed', 'Ziggs', 'Zyra'
    ]

    const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
    
    // Generate 10 participants (5 per team)
    const participants = Array.from({ length: 10 }, (_, i) => {
      const isBlueTeam = i < 5
      const teamId = isBlueTeam ? 100 : 200
      const position = positions[i % 5]
      const champion = champions[Math.floor(Math.random() * champions.length)]
      
      const kills = Math.floor(Math.random() * 15)
      const deaths = Math.floor(Math.random() * 10)
      const assists = Math.floor(Math.random() * 20)
      const isCurrentPlayer = i === 0 // First player is the searched player
      
      return {
        id: i + 1,
        participant_id: i + 1,
        team_id: teamId,
        champion_id: Math.floor(Math.random() * 160) + 1,
        champion_name: champion,
        champion_level: Math.floor(Math.random() * 8) + 13,
        kills,
        deaths,
        assists,
        gold_earned: Math.floor(Math.random() * 15000) + 8000,
        total_damage_dealt_to_champions: Math.floor(Math.random() * 40000) + 15000,
        total_damage_taken: Math.floor(Math.random() * 30000) + 10000,
        total_minions_killed: Math.floor(Math.random() * 200) + 50,
        neutral_minions_killed: position === 'JUNGLE' ? Math.floor(Math.random() * 100) + 50 : Math.floor(Math.random() * 20),
        vision_score: Math.floor(Math.random() * 60) + 20,
        wards_placed: Math.floor(Math.random() * 20) + 5,
        wards_killed: Math.floor(Math.random() * 15) + 2,
        item0: Math.floor(Math.random() * 100) + 1000,
        item1: Math.floor(Math.random() * 100) + 2000,
        item2: Math.floor(Math.random() * 100) + 3000,
        item3: Math.floor(Math.random() * 100) + 1000,
        item4: Math.floor(Math.random() * 100) + 2000,
        item5: Math.floor(Math.random() * 100) + 3000,
        item6: Math.floor(Math.random() * 10) + 2000, // Trinket
        summoner1_id: Math.floor(Math.random() * 14) + 1,
        summoner2_id: Math.floor(Math.random() * 14) + 1,
        win: isBlueTeam ? (matchData?.win ?? Math.random() > 0.5) : !(matchData?.win ?? Math.random() > 0.5),
        team_position: position,
        lane: position === 'MIDDLE' ? 'MID' : position === 'BOTTOM' ? 'BOT' : position,
        double_kills: Math.floor(Math.random() * 3),
        triple_kills: Math.floor(Math.random() * 2),
        quadra_kills: Math.random() > 0.9 ? 1 : 0,
        penta_kills: Math.random() > 0.98 ? 1 : 0,
        isCurrentPlayer,
        summoners: {
          summoner_name: isCurrentPlayer ? (matchData?.summoner_name || 'You') : `Player${i + 1}`,
          summoner_level: Math.floor(Math.random() * 200) + 30
        }
      }
    })

    return {
      id: matchData?.id || 1,
      match_id: matchData?.matches?.match_id || `MATCH_${Date.now()}`,
      game_creation: Date.now() - Math.floor(Math.random() * 86400000),
      game_duration: matchData?.matches?.game_duration || Math.floor(Math.random() * 1800) + 900,
      game_mode: matchData?.matches?.game_mode || 'Classic',
      game_type: 'MATCHED_GAME',
      queue_id: matchData?.matches?.queue_id || 420,
      map_id: 11,
      match_participants: participants
    }
  }

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  const calculateKDA = (kills, deaths, assists) => {
    if (deaths === 0) return 'Perfect'
    return ((kills + assists) / deaths).toFixed(2)
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

  const filterParticipants = (participants) => {
    if (selectedTeam === 'blue') return participants.filter(p => p.team_id === 100)
    if (selectedTeam === 'red') return participants.filter(p => p.team_id === 200)
    return participants
  }

  const getTeamStats = (participants, teamId) => {
    const teamPlayers = participants.filter(p => p.team_id === teamId)
    return {
      kills: teamPlayers.reduce((sum, p) => sum + p.kills, 0),
      deaths: teamPlayers.reduce((sum, p) => sum + p.deaths, 0),
      assists: teamPlayers.reduce((sum, p) => sum + p.assists, 0),
      gold: teamPlayers.reduce((sum, p) => sum + p.gold_earned, 0),
      damage: teamPlayers.reduce((sum, p) => sum + p.total_damage_dealt_to_champions, 0),
      vision: teamPlayers.reduce((sum, p) => sum + p.vision_score, 0),
      cs: teamPlayers.reduce((sum, p) => sum + p.total_minions_killed + p.neutral_minions_killed, 0)
    }
  }

  if (!match) {
    return (
      <div className="specific-match">
        <div className="error-state">
          <h2>No Match Selected</h2>
          <p>Please select a match from the match history.</p>
          <button onClick={() => onNavigate('search')}>
            Go to Search
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="specific-match">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading match details...</p>
        </div>
      </div>
    )
  }

  if (error && !matchDetails) {
    return (
      <div className="specific-match">
        <div className="error-state">
          <h2>Error Loading Match</h2>
          <p>{error}</p>
          <button onClick={() => onNavigate('match-history')}>
            Back to Match History
          </button>
        </div>
      </div>
    )
  }

  const blueTeamStats = getTeamStats(matchDetails.match_participants, 100)
  const redTeamStats = getTeamStats(matchDetails.match_participants, 200)
  const blueTeamWon = matchDetails.match_participants.find(p => p.team_id === 100)?.win
  const currentPlayer = matchDetails.match_participants.find(p => p.isCurrentPlayer)

  return (
    <div className="specific-match">
      {/* Match Header */}
      <div className="match-header">
        <div className="match-info">
          <h1>{getQueueName(matchDetails.queue_id)}</h1>
          <div className="match-meta">
            <span>{formatDuration(matchDetails.game_duration)}</span>
            <span>•</span>
            <span>{new Date(matchDetails.game_creation).toLocaleDateString()}</span>
            <span>•</span>
            <span>Match ID: {matchDetails.match_id}</span>
          </div>
        </div>
        <button 
          onClick={() => onNavigate('match-history')} 
          className="back-button"
        >
          ← Back to History
        </button>
      </div>

      {/* Match Result */}
      <div className="match-result-banner">
        <div className={`result-indicator ${currentPlayer?.win ? 'victory' : 'defeat'}`}>
          {currentPlayer?.win ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div className="match-duration">
          Game Duration: {formatDuration(matchDetails.game_duration)}
        </div>
      </div>

      {/* Team Stats Overview */}
      <div className="team-stats-overview">
        <div className={`team-stat ${blueTeamWon ? 'winning-team' : 'losing-team'}`}>
          <h3 className="team-name">Blue Team {blueTeamWon ? '(Victory)' : '(Defeat)'}</h3>
          <div className="team-totals">
            <span>{blueTeamStats.kills}/{blueTeamStats.deaths}/{blueTeamStats.assists}</span>
            <span>{formatNumber(blueTeamStats.gold)} gold</span>
            <span>{formatNumber(blueTeamStats.damage)} damage</span>
          </div>
        </div>
        
        <div className="vs-divider">VS</div>
        
        <div className={`team-stat ${!blueTeamWon ? 'winning-team' : 'losing-team'}`}>
          <h3 className="team-name">Red Team {!blueTeamWon ? '(Victory)' : '(Defeat)'}</h3>
          <div className="team-totals">
            <span>{redTeamStats.kills}/{redTeamStats.deaths}/{redTeamStats.assists}</span>
            <span>{formatNumber(redTeamStats.gold)} gold</span>
            <span>{formatNumber(redTeamStats.damage)} damage</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="match-tabs">
        <button 
          className={selectedTab === 'overview' ? 'active' : ''}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button 
          className={selectedTab === 'builds' ? 'active' : ''}
          onClick={() => setSelectedTab('builds')}
        >
          Builds & Items
        </button>
        <button 
          className={selectedTab === 'timeline' ? 'active' : ''}
          onClick={() => setSelectedTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {/* Team Filter */}
      <div className="team-filter">
        <button 
          className={selectedTeam === 'all' ? 'active' : ''}
          onClick={() => setSelectedTeam('all')}
        >
          All Players
        </button>
        <button 
          className={selectedTeam === 'blue' ? 'active' : ''}
          onClick={() => setSelectedTeam('blue')}
        >
          Blue Team
        </button>
        <button 
          className={selectedTeam === 'red' ? 'active' : ''}
          onClick={() => setSelectedTeam('red')}
        >
          Red Team
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="participants-table">
          <div className="table-header">
            <div className="player-col">Player</div>
            <div className="kda-col">KDA</div>
            <div className="damage-col">Damage</div>
            <div className="gold-col">Gold</div>
            <div className="cs-col">CS</div>
            <div className="vision-col">Vision</div>
            <div className="items-col">Items</div>
          </div>
          
          {filterParticipants(matchDetails.match_participants)
            .sort((a, b) => a.team_id - b.team_id)
            .map(participant => (
            <div 
              key={participant.id} 
              className={`participant-row ${participant.isCurrentPlayer ? 'current-player' : ''} ${participant.team_id === 100 ? 'blue-team' : 'red-team'}`}
            >
              <div className="player-info">
                <div className="champion-icon">
                  <img 
                    src={`/league_files/15.8.1/img/champion/${participant.champion_name}.png`}
                    alt={participant.champion_name}
                    onError={(e) => {
                      e.target.src = '/league_files/img/champion/default.png'
                    }}
                  />
                  <span className="champion-level">{participant.champion_level}</span>
                </div>
                <div className="player-details">
                  <span className="summoner-name">
                    {participant.summoners?.summoner_name}
                    {participant.isCurrentPlayer && <span className="you-indicator">(You)</span>}
                  </span>
                  <span className="champion-name">{participant.champion_name}</span>
                  <span className="position">{participant.team_position}</span>
                </div>
                <div className="summoner-spells">
                  <img 
                    src={`/league_files/15.8.1/img/spell/${participant.summoner1_id}.png`}
                    alt="Spell 1"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <img 
                    src={`/league_files/15.8.1/img/spell/${participant.summoner2_id}.png`}
                    alt="Spell 2"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              </div>
              
              <div className="kda-stats">
                <span className="kda-numbers">{participant.kills}/{participant.deaths}/{participant.assists}</span>
                <span className="kda-ratio">{calculateKDA(participant.kills, participant.deaths, participant.assists)}</span>
                {(participant.double_kills > 0 || participant.triple_kills > 0 || participant.quadra_kills > 0 || participant.penta_kills > 0) && (
                  <div className="multikills">
                    {participant.penta_kills > 0 && <span className="penta">PENTA!</span>}
                    {participant.quadra_kills > 0 && <span className="quadra">QUADRA!</span>}
                    {participant.triple_kills > 0 && <span className="triple">TRIPLE!</span>}
                    {participant.double_kills > 0 && <span className="double">DOUBLE!</span>}
                  </div>
                )}
              </div>
              
              <div className="damage-stat">
                <span>{formatNumber(participant.total_damage_dealt_to_champions)}</span>
              </div>
              
              <div className="gold-stat">
                <span>{formatNumber(participant.gold_earned)}</span>
              </div>
              
              <div className="cs-stat">
                <span>{participant.total_minions_killed + participant.neutral_minions_killed}</span>
              </div>
              
              <div className="vision-stat">
                <span>{participant.vision_score}</span>
                <div className="wards-info">
                  <small>{participant.wards_placed}👁️ {participant.wards_killed}🔍</small>
                </div>
              </div>
              
              <div className="items-list">
                {[participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6].map((item, index) => (
                  <div key={index} className={`item-slot ${index === 6 ? 'trinket' : ''}`}>
                    {item > 0 && (
                      <img 
                        src={`/league_files/15.8.1/img/item/${item}.png`}
                        alt={`Item ${item}`}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTab === 'builds' && (
        <div className="builds-content">
          <h3>Item Builds & Progression</h3>
          <p>Detailed item progression and build paths will be shown here.</p>
          <div className="coming-soon">
            <span>📈 Advanced build analysis coming soon!</span>
          </div>
        </div>
      )}

      {selectedTab === 'timeline' && (
        <div className="timeline-content">
          <h3>Match Timeline</h3>
          <p>Key events, objectives, and team fights throughout the game.</p>
          <div className="coming-soon">
            <span>⏱️ Timeline analysis coming soon!</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SpecificMatch