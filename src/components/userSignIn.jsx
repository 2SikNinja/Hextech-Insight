import { useState } from 'react'
import { DatabaseService } from '../database/database-service.js'
import supabase from '../database/supabase-client.js'
import '../styles/userSignIn.css'

function UserSignIn({ onNavigate }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))

    // Clear errors when user starts typing
    if (error) setError(null)
  }

  const validateForm = () => {
    if (!formData.email.trim()) {
      return 'Email is required'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address'
    }
    if (!formData.password) {
      return 'Password is required'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await DatabaseService.signIn(
        formData.email,
        formData.password
      )

      if (signInError) {
        throw signInError
      }

      // Success! The auth state change listener in App.jsx will handle the redirect
      console.log('Sign in successful:', data)

    } catch (err) {
      console.error('Sign in error:', err)
      
      // Handle specific Supabase errors
      if (err.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.')
      } else if (err.message.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.')
      } else if (err.message.includes('Too many requests')) {
        setError('Too many sign in attempts. Please wait a moment and try again.')
      } else {
        setError('Failed to sign in. Please check your credentials and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)

    try {
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (googleError) {
        throw googleError
      }

      // The redirect will happen automatically
      console.log('Google sign in initiated:', data)

    } catch (err) {
      console.error('Google sign in error:', err)
      
      // Handle specific Google OAuth errors
      if (err.message.includes('popup_closed_by_user')) {
        setError('Sign in was cancelled. Please try again.')
      } else if (err.message.includes('network')) {
        setError('Network error. Please check your connection and try again.')
      } else if (err.message.includes('OAuth')) {
        setError('Google sign in is temporarily unavailable. Please try email sign in instead.')
      } else {
        setError('Failed to sign in with Google. Please try again or use email sign in.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!formData.email.trim()) {
      setError('Please enter your email address first')
      return
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        throw resetError
      }

      setError('Password reset email sent! Check your inbox.')
      setTimeout(() => setError(null), 5000)
      
    } catch (err) {
      console.error('Password reset error:', err)
      
      if (err.message.includes('Email not found')) {
        setError('No account found with this email address.')
      } else if (err.message.includes('Too many requests')) {
        setError('Too many password reset attempts. Please wait before trying again.')
      } else {
        setError('Failed to send password reset email. Please try again.')
      }
    }
  }

  return (
    <div className="user-signin">
      <div className="signin-container">
        <div className="header">
          <h1>Welcome Back</h1>
          <p>Sign in to your Hextech Insight account</p>
        </div>

        <form onSubmit={handleSubmit} className="signin-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled={loading || googleLoading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              disabled={loading || googleLoading}
              autoComplete="current-password"
            />
          </div>

          <div className="form-options">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  disabled={loading || googleLoading}
                />
                <span className="checkmark"></span>
                Remember me
              </label>
            </div>

            <button 
              type="button" 
              className="forgot-password"
              onClick={handleForgotPassword}
              disabled={loading || googleLoading}
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="signin-button"
            disabled={loading || googleLoading || !formData.email || !formData.password}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <div className="social-signin">
          <button 
            className="google-signin" 
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            type="button"
          >
            {googleLoading ? (
              <>
                <div className="loading-spinner small"></div>
                Signing in with Google...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>

        <div className="signup-link">
          Don't have an account? 
          <button 
            onClick={() => onNavigate('signup')}
            className="link-button"
            disabled={loading || googleLoading}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserSignIn