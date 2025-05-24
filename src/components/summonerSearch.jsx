// src/components/summonerSearch.jsx
import { useState } from 'react'
import { DatabaseService } from '../database/database-service.js'
import './styles/summonerSearch.css'

function SummonerSearch() {
  const [searchTerm, setSearchTerm] = useState('')
  const [region, setRegion] = useState('na1')
  const [summoner, setSummoner] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const regions = [
    { value: 'na1', label: 'North America' },
    { value: 'euw1', label: 'Europe West' },
    { value: 'eun1', label: 'Europe Nordic & East' },
    { value: 'kr', label: 'Korea' },
    { value: 'jp1', label: 'Japan' },
    { value: 'br1', label: 'Brazil' },
    { value: 'la1', label: 'Latin America North' },
    { value: 'la2', label: 'Latin America South' },
    { value: 'oc1', label: 'Oceania' },
    { value: 'tr1', label: 'Turkey' },
    { value: 'ru', label: 'Russia' }
  ]

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setError(null)
    setSummoner(null)

    try {
      // First, try to find in our database
      const { data: existingSummoner, error: dbError } = await DatabaseService.searchSummoner(
        searchTerm.trim(),
        region
      )

      if (existingSummoner) {
        setSummoner(existingSummoner)
      } else {
        // If not found, call Riot API here
        // For now show a message
        setError('Summoner not found in database. In a real app, this would fetch from Riot API.')
      }
    } catch (err) {
      setError('Failed to search for summoner. Please try again.')
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="summoner-search">
      <h2>Search Summoner</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="input-group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter summoner name..."
            className="summoner-input"
            disabled={loading}
          />
          
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="region-select"
            disabled={loading}
          >
            {regions.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          
          <button type="submit" disabled={loading || !searchTerm.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {summoner && (
        <div className="summoner-result">
          <h3>{summoner.summoner_name}</h3>
          <div className="summoner-info">
            <p><strong>Level:</strong> {summoner.summoner_level}</p>
            <p><strong>Region:</strong> {summoner.region.toUpperCase()}</p>
            <p><strong>Last Updated:</strong> {new Date(summoner.last_updated).toLocaleDateString()}</p>
          </div>
          
          <div className="action-buttons">
            <button onClick={() => {/* Navigate to match history */}}>
              View Match History
            </button>
            <button onClick={() => {/* Navigate to player stats */}}>
              View Stats
            </button>
            <button onClick={() => {/* Add to favorites */}}>
              Add to Favorites
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SummonerSearch