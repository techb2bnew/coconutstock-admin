'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function OtpPage() {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')

  const inputRefs = useRef<HTMLInputElement[]>([])
  const router = useRouter()

  useEffect(() => {
    // Handle Magic Link redirect (if user clicks email link)
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const error = hashParams.get('error')
      const errorCode = hashParams.get('error_code')
      
      // If Magic Link was clicked and expired, show error
      if (error === 'access_denied' && errorCode === 'otp_expired') {
        setError('The email link has expired. Please request a new OTP code.')
        // Clear hash
        window.history.replaceState(null, '', window.location.pathname)
      }
      
      // Get email from sessionStorage
      const storedEmail = sessionStorage.getItem('reset_password_email')
      if (storedEmail) {
        setEmail(storedEmail)
      } else {
        // If no email found, redirect back to forgot password
        router.push('/forgot-password')
      }
    }
  }, [router])

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // allow only digits
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // move to next box if digit entered
    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '') {
        if (index > 0) inputRefs.current[index - 1]?.focus()
      } else {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    }
  }

  const validateForm = (): boolean => {
    const otpValue = otp.join('')
    if (!otpValue) {
      setError('OTP is required')
      return false
    } else if (otpValue.length !== 6 && otpValue.length !== 8) {
      setError('OTP must be 6 or 8 digits')
      return false
    }
    setError(null)
    return true
  }

  const handleVerifyOtp = async () => {
    if (!validateForm() || !email) return

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp.join(''),
        type: 'email',
      })

      if (error) {
        setError(error.message)
        setIsLoading(false)
        return
      }

      // Verify that OTP verification was successful and session was created
      if (!data || !data.session) {
        setError('OTP verification failed. Please try again.')
        setIsLoading(false)
        return
      }

      // Verify session is properly established
      // Wait a moment for session to be fully set in Supabase
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Double-check session is available
      const { data: { session: verifySession } } = await supabase.auth.getSession()
      if (!verifySession) {
        setError('Session not established. Please try again.')
        setIsLoading(false)
        return
      }

      // Set OTP verification flag for security - ensure it's set before redirect
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('otp_verified', 'true')
        // Store timestamp for expiration check (15 minutes validity)
        sessionStorage.setItem('otp_verified_timestamp', Date.now().toString())
        // Also store email for reset-password page
        sessionStorage.setItem('reset_password_email', email)
        // Clear any previous password reset used flag
        sessionStorage.removeItem('password_reset_used')
        
        // Verify sessionStorage was set
        const verifyFlag = sessionStorage.getItem('otp_verified')
        if (verifyFlag !== 'true') {
          setError('Failed to set verification flag. Please try again.')
          setIsLoading(false)
          return
        }
      }

      setSuccessMessage('OTP verified successfully! Redirecting...')
      // Use a small delay to ensure everything is persisted
      setTimeout(() => {
        // Use window.location as fallback if router doesn't work
        try {
          router.replace('/reset-password')
        } catch (err) {
          console.error('Router redirect failed, using window.location:', err)
          window.location.href = '/reset-password'
        }
      }, 500)
    } catch (err: any) {
      console.error('OTP verification error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  // Retry function with exponential backoff for resend
  const resendOTPWithRetry = async (retries = 2, delay = 1000): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 seconds timeout
        })

        // Create the OTP request - removed emailRedirectTo to get OTP code instead of Magic Link
        const otpPromise = supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false
            // Removed emailRedirectTo - this forces Magic Link, we want OTP code instead
          }
        })

        // Race between timeout and actual request
        const { data, error } = await Promise.race([otpPromise, timeoutPromise]) as any

        if (error) {
          // If it's a retryable error and we have retries left, retry
          if (
            (error.message?.includes('504') || 
             error.message?.includes('timeout') || 
             error.message?.includes('retry') ||
             error.message?.includes('network')) &&
            attempt < retries
          ) {
            const waitTime = delay * Math.pow(2, attempt)
            console.log(`Resend retry attempt ${attempt + 1} after ${waitTime}ms`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          return { data, error }
        }

        return { data, error: null }
      } catch (err: any) {
        // If it's a timeout and we have retries left, retry
        if (
          (err.message?.includes('timeout') || err.message?.includes('504')) &&
          attempt < retries
        ) {
          const waitTime = delay * Math.pow(2, attempt)
          console.log(`Resend retry attempt ${attempt + 1} after ${waitTime}ms`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        return { data: null, error: err }
      }
    }
    return { data: null, error: { message: 'Request failed after multiple attempts' } }
  }

  const handleResendOtp = async () => {
    if (!email) return

    setIsResending(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Use retry logic with exponential backoff
      const { data, error } = await resendOTPWithRetry(2, 2000)

      if (error) {
        if (error.message?.includes('504') || error.message?.includes('timeout') || error.message?.includes('retry')) {
          setError('Email service is currently slow. The OTP may still be sent. Please check your email in a few moments.')
        } else {
          setError(error.message || 'Failed to resend OTP. Please try again.')
        }
        setIsResending(false)
        return
      }

      setSuccessMessage('OTP has been resent to your email!')
      setIsResending(false)
    } catch (err: any) {
      console.error('Resend OTP error:', err)
      if (err.message?.includes('timeout') || err.message?.includes('504')) {
        setError('Email service is currently slow. The OTP may still be sent. Please check your email in a few moments.')
      } else {
        setError('Failed to resend OTP. Please try again.')
      }
      setIsResending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleVerifyOtp()
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] border border-slate-100 p-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Enter OTP</h2>
          <p className="text-sm text-slate-600 mt-1">
            Check your email for the One-Time Password.
          </p>
        </div>

        {/* OTP Boxes */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="mb-5">
            <div className="flex gap-4 justify-center">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    if (el) inputRefs.current[index] = el
                  }}
                  type="text"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-12 h-[60px] text-center text-[28px] font-medium border rounded-[10px] transition-all ${
                    digit
                      ? 'border-gray-900 text-gray-900'
                      : 'border-[rgba(17,24,39,0.2)] text-gray-700'
                  } focus:outline-none focus:border-[#00a1ff]`}
                  maxLength={1}
                />
              ))}
            </div>
            <div className="mt-3 text-center text-xs text-slate-500">
              Tip: You can use Backspace to move to the previous box.
            </div>
            {error && <p className="mt-2 text-xs text-rose-600 text-center">{error}</p>}
            {successMessage && (
              <p className="mt-2 text-xs text-green-600 text-center">{successMessage}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold"
          >
            {isLoading ? 'Verifying…' : 'Verify OTP'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          Didn&apos;t receive an OTP?{' '}
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isResending || !email}
            className="underline text-sky-600 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? 'Resending...' : 'Resend'}
          </button>
        </div>
      </div>
    </div>
  )
}
