import { useState, useEffect } from 'react'
import './styles/App.css'
import supabase from "./database/supabase-client"
import { DatabaseService } from './database/database-service.js'

// Import all components
import SummonerSearch from './components/summonerSearch'
import AccountCreation from './components/accountCreation'
import UserSignIn from './components/userSignIn'
import MatchHistory from './components/matchHistory'
import PlayerStats from './components/playerStats'
import SpecificMatch from './components/specificMatch'
import UserFavorites from './components/userFavorites'
import RiotNotice from './components/riotNotice'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for existing user session on app load
  useEffect(() => {
    checkUser()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
        setCurrentPage('search') // Redirect to search after sign in
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setCurrentPage('home')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUser = async () => {
    try {
      const currentUser = await DatabaseService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await DatabaseService.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const renderNavigation = () => (
    <nav className="main-nav">
      <div className="nav-brand">
        <h2 onClick={() => setCurrentPage('home')}>Hextech Insight</h2>
      </div>
      
      <div className="nav-links">
        {user ? (
          <>
            <button 
              onClick={() => setCurrentPage('search')}
              className={currentPage === 'search' ? 'active' : ''}
            >
              Search
            </button>
            <button 
              onClick={() => setCurrentPage('favorites')}
              className={currentPage === 'favorites' ? 'active' : ''}
            >
              Favorites
            </button>
            <button 
              onClick={() => setCurrentPage('notice')}
              className={currentPage === 'notice' ? 'active' : ''}
            >
              Legal
            </button>
            <div className="user-menu">
              <span className="user-welcome">Welcome, {user.user_metadata?.username || user.email}</span>
              <button onClick={handleSignOut} className="sign-out-btn">
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <>
            <button 
              onClick={() => setCurrentPage('search')}
              className={currentPage === 'search' ? 'active' : ''}
            >
              Search
            </button>
            <button 
              onClick={() => setCurrentPage('notice')}
              className={currentPage === 'notice' ? 'active' : ''}
            >
              Legal
            </button>
            <button 
              onClick={() => setCurrentPage('signin')}
              className={currentPage === 'signin' ? 'active' : ''}
            >
              Sign In
            </button>
            <button 
              onClick={() => setCurrentPage('signup')}
              className={currentPage === 'signup' ? 'active' : ''}
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  )

  const renderHomePage = () => (
    <div className="home-page">
      <div className="hero-section">
        <h1>Hextech Insight</h1>
        <p className="hero-subtitle">Advanced League of Legends Statistics & Analysis</p>
        <p className="hero-description">
          Track your performance, analyze match history, and gain insights to improve your gameplay. 
          Search for any summoner across all regions and dive deep into detailed statistics.
        </p>
        
        <div className="hero-actions">
          <button 
            onClick={() => setCurrentPage('search')}
            className="primary-action"
          >
            Start Searching
          </button>
          {!user && (
            <button 
              onClick={() => setCurrentPage('signup')}
              className="secondary-action"
            >
              Create Account
            </button>
          )}
        </div>
      </div>

      <div className="features-section">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Summoner Search</h3>
            <p>Search for any player across all League of Legends regions</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Detailed Statistics</h3>
            <p>View comprehensive stats including KDA, win rates, and performance trends</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Match History</h3>
            <p>Analyze recent games with detailed match breakdowns</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Favorites</h3>
            <p>Save your favorite players for quick access (account required)</p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return renderHomePage()
      case 'search':
        return <SummonerSearch />
      case 'signup':
        return <AccountCreation />
      case 'signin':
        return <UserSignIn />
      case 'favorites':
        return user ? <UserFavorites /> : renderHomePage()
      case 'match-history':
        return <MatchHistory />
      case 'player-stats':
        return <PlayerStats />
      case 'specific-match':
        return <SpecificMatch />
      case 'notice':
        return <RiotNotice />
      default:
        return renderHomePage()
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading Hextech Insight...</p>
      </div>
    )
  }

  return (
    <div className="App">
      {renderNavigation()}
      <main className="main-content">
        {renderCurrentPage()}
      </main>
    </div>
  )
}

export default App