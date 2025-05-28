import { useState, useEffect } from 'react'
import { RiotApiService } from '../database/riot-api-service.js'
import '../styles/matchTimeline.css'

function MatchTimeline({ matchId, region, onNavigate }) {
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadMatchTimeline()
  }, [matchId])

  const loadMatchTimeline = async () => {
    if (!matchId) return

    setLoading(true)
    setError(null)

    try {
      // Get match timeline using Riot API
      const continentalEndpoint = RiotApiService.getContinentalEndpoint(region)
      const url = `${continentalEndpoint}/lol/match/v5/matches/${matchId}/timeline`
      
      const timelineData = await RiotApiService.makeRequest(url)
      setTimeline(timelineData)
    } catch (err) {
      console.error('Error loading match timeline:', err)
      setError('Failed to load match timeline')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    const minutes = Math.floor(timestamp / 60000)
    const seconds = Math.floor((timestamp % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getEventIcon = (eventType) => {
    const icons = {
      'CHAMPION_KILL': '⚔️',
      'BUILDING_KILL': '🏗️',
      'MONSTER_KILL': '🐉',
      'ITEM_PURCHASED': '🛡️',
      'ITEM_SOLD': '💰',
      'WARD_PLACED': '👁️',
      'WARD_KILL': '🔍',
      'LEVEL_UP': '⬆️'
    }
    return icons[eventType] || '📝'
  }

  const filterImportantEvents = (events) => {
    const importantTypes = [
      'CHAMPION_KILL',
      'BUILDING_KILL', 
      'ELITE_MONSTER_KILL',
      'DRAGON_KILL',
      'BARON_KILL'
    ]
    
    return events.filter(event => 
      importantTypes.includes(event.type) ||
      (event.type === 'MONSTER_KILL' && 
       ['DRAGON', 'BARON_NASHOR', 'RIFTHERALD'].includes(event.monsterType))
    )
  }

  if (loading) {
    return (
      <div className="match-timeline">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading match timeline...</p>
        </div>
      </div>
    )
  }

  if (error || !timeline) {
    return (
      <div className="match-timeline">
        <div className="error-state">
          <h3>Timeline Unavailable</h3>
          <p>{error || 'Match timeline data is not available for this match.'}</p>
        </div>
      </div>
    )
  }

  const allEvents = timeline.info.frames.flatMap(frame => 
    frame.events.map(event => ({
      ...event,
      timestamp: frame.timestamp
    }))
  )

  const importantEvents = filterImportantEvents(allEvents)

  return (
    <div className="match-timeline">
      <div className="timeline-header">
        <h3>📊 Match Timeline</h3>
        <p>Key events throughout the match</p>
      </div>

      <div className="timeline-container">
        <div className="timeline-line"></div>
        
        {importantEvents.map((event, index) => (
          <div key={index} className={`timeline-event ${event.type.toLowerCase()}`}>
            <div className="event-time">
              {formatTimestamp(event.timestamp)}
            </div>
            
            <div className="event-marker">
              <span className="event-icon">
                {getEventIcon(event.type)}
              </span>
            </div>
            
            <div className="event-details">
              <div className="event-title">
                {event.type === 'CHAMPION_KILL' && (
                  <>
                    <strong>Kill</strong>
                    {event.assistingParticipantIds?.length > 0 && 
                      ` (+${event.assistingParticipantIds.length} assists)`
                    }
                  </>
                )}
                
                {event.type === 'BUILDING_KILL' && (
                  <strong>{event.buildingType} Destroyed</strong>
                )}
                
                {(event.type === 'ELITE_MONSTER_KILL' || event.monsterType) && (
                  <strong>
                    {event.monsterType === 'DRAGON' && '🐉 Dragon'}
                    {event.monsterType === 'BARON_NASHOR' && '👑 Baron'}
                    {event.monsterType === 'RIFTHERALD' && '👁️ Herald'}
                    {!event.monsterType && 'Objective'}
                  </strong>
                )}
              </div>
              
              <div className="event-description">
                {event.type === 'CHAMPION_KILL' && (
                  <span>
                    Participant {event.killerId} killed Participant {event.victimId}
                  </span>
                )}
                
                {event.type === 'BUILDING_KILL' && (
                  <span>
                    {event.buildingType} in {event.laneType} lane
                  </span>
                )}
                
                {event.monsterType && (
                  <span>
                    Team {event.killerTeamId === 100 ? 'Blue' : 'Red'} secured {event.monsterType}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {importantEvents.length === 0 && (
        <div className="no-events">
          <p>No major events recorded for this match.</p>
        </div>
      )}
    </div>
  )
}

export default MatchTimeline