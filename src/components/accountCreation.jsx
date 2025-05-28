import { useState } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/accountCreation.css'

function AccountCreation({ onNavigate }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: []
  })

  const validatePassword = (password) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }

    const score = Object.values(checks).filter(Boolean).length
    const feedback = []

    if (!checks.length) feedback.push('At least 8 characters')
    if (!checks.uppercase) feedback.push('One uppercase letter')
    if (!checks.lowercase) feedback.push('One lowercase letter')
    if (!checks.number) feedback.push('One number')
    if (!checks.special) feedback.push('One special character')

    return { score, feedback }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))

    if (name === 'password') {
      setPasswordStrength(validatePassword(value))
    }

    // Clear errors when user starts typing
    if (error) setError(null)
  }

  const validateForm = () => {
    // Username validation
    if (!formData.username.trim()) {
      return 'Username is required'
    }
    if (formData.username.length < 3) {
      return 'Username must be at least 3 characters'
    }
    if (formData.username.length > 20) {
      return 'Username must be less than 20 characters'
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      return 'Username can only contain letters, numbers, and underscores'
    }

    // Email validation
    if (!formData.email.trim()) {
      return 'Email is required'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      return 'Password is required'
    }
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long'
    }
    if (passwordStrength.score < 3) {
      return 'Password is too weak. Please meet more requirements.'
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }

    // Terms validation
    if (!formData.agreeToTerms) {
      return 'You must agree to the terms and conditions'
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
      console.log('🔐 Attempting account creation...')
      
      const { data, error: signUpError } = await DatabaseService.signUp(
        formData.email.trim(),
        formData.password,
        formData.username.trim()
      )

      if (signUpError) {
        throw signUpError
      }

      if (data?.user) {
        console.log('✅ Account creation successful!')
        setSuccess(true)
        
        // Clear form data
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          agreeToTerms: false
        })
        setPasswordStrength({ score: 0, feedback: [] })
      }

    } catch (err) {
      console.error('❌ Account creation error:', err)
      
      // Handle specific Supabase errors
      if (err.message?.includes('User already registered') || 
          err.message?.includes('already been registered')) {
        setError('An account with this email already exists. Try signing in instead.')
      } else if (err.message?.includes('Password should be at least')) {
        setError('Password does not meet minimum requirements')
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address')
      } else if (err.message?.includes('Signup is disabled')) {
        setError('Account registration is currently disabled. Please contact support.')
      } else if (err.message?.includes('Email rate limit exceeded')) {
        setError('Too many signup attempts. Please wait a few minutes and try again.')
      } else {
        setError('Failed to create account. Please check your information and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('🔐 Attempting Google sign up...')
      
      const { data, error: googleError } = await DatabaseService.signInWithGoogle()

      if (googleError) {
        throw googleError
      }

      console.log('🔄 Google sign up initiated, awaiting redirect...')
      // The redirect will happen automatically

    } catch (err) {
      console.error('❌ Google sign up error:', err)
      
      if (err.message?.includes('popup_closed_by_user')) {
        setError('Sign up was cancelled. Please try again.')
      } else if (err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.')
      } else {
        setError('Failed to sign up with Google. Please try the email method instead.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 1) return '#ff4757'
    if (passwordStrength.score <= 2) return '#ffa502'
    if (passwordStrength.score <= 3) return '#ffb142'
    if (passwordStrength.score <= 4) return '#7bed9f'
    return '#2ed573'
  }

  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 1) return 'Very Weak'
    if (passwordStrength.score <= 2) return 'Weak'
    if (passwordStrength.score <= 3) return 'Fair'
    if (passwordStrength.score <= 4) return 'Good'
    return 'Strong'
  }

  if (success) {
    return (
      <div className="account-creation">
        <div className="success-container">
          <div className="success-icon">✓</div>
          <h2>Account Created Successfully!</h2>
          <p>
            We've sent a confirmation email to <strong>{formData.email}</strong>. 
            Please check your inbox and click the confirmation link to activate your account.
          </p>
          <p>
            <small>Don't see the email? Check your spam folder or try signing in if you've already confirmed.</small>
          </p>
          <div className="success-actions">
            <button 
              onClick={() => onNavigate('signin')}
              className="signin-button"
            >
              Go to Sign In
            </button>
            <button 
              onClick={() => {
                setSuccess(false)
                setFormData({
                  username: '',
                  email: '',
                  password: '',
                  confirmPassword: '',
                  agreeToTerms: false
                })
              }}
              className="back-button"
            >
              Create Another Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="account-creation">
      <div className="creation-container">
        <div className="header">
          <h1>Create Your Account</h1>
          <p>Join Hextech Insight to track your League of Legends progress</p>
        </div>



        <form onSubmit={handleSubmit} className="creation-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              disabled={loading}
              maxLength={20}
              required
            />
            <div className="input-hint">
              3-20 characters, letters, numbers, and underscores only
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled={loading}
              required
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
              placeholder="Create a strong password"
              disabled={loading}
              required
            />
            {formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill"
                    style={{ 
                      width: `${(passwordStrength.score / 5) * 100}%`,
                      backgroundColor: getPasswordStrengthColor()
                    }}
                  ></div>
                </div>
                <div className="strength-info">
                  <span 
                    className="strength-text"
                    style={{ color: getPasswordStrengthColor() }}
                  >
                    {getPasswordStrengthText()}
                  </span>
                  {passwordStrength.feedback.length > 0 && (
                    <div className="strength-requirements">
                      Missing: {passwordStrength.feedback.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              disabled={loading}
              required
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <div className="password-mismatch">
                Passwords do not match
              </div>
            )}
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
              <span className="checkmark"></span>
              I agree to the{' '}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate('notice')
                }}
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate('notice')
                }}
              >
                Privacy Policy
              </a>
            </label>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="create-button"
            disabled={loading || !formData.agreeToTerms}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="signin-link">
          Already have an account? 
          <button 
            onClick={() => onNavigate('signin')}
            className="link-button"
            disabled={loading}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountCreation