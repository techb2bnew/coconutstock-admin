'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

interface FormErrors {
  email?: string
}
  
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')

  const router = useRouter()

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    if (!email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Retry function with exponential backoff
  const sendOTPWithRetry = async (retries = 2, delay = 1000): Promise<any> => {
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
            console.log(`Retry attempt ${attempt + 1} after ${waitTime}ms`)
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
          console.log(`Retry attempt ${attempt + 1} after ${waitTime}ms`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        return { data: null, error: err }
      }
    }
    return { data: null, error: { message: 'Request failed after multiple attempts' } }
  }

  const handleSendOTP = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    setSuccessMessage('')
    setErrors({})

    try {
      // Use retry logic with exponential backoff
      const { data, error } = await sendOTPWithRetry(2, 2000)

      if (error) {
        console.error('Send OTP error:', error)
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: (error as any).code
        })
        
        // Handle specific error codes
        if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
          setErrors({ email: 'Too many requests. Please wait a few minutes and try again.' })
        } else if (error.message?.includes('not found') || error.message?.includes('user') || error.message?.includes('email')) {
          setErrors({ email: 'No account found with this email address.' })
        } else if (error.message?.includes('504') || error.message?.includes('timeout') || error.message?.includes('retry') || error.message?.includes('Gateway')) {
          setErrors({ email: 'Email service timeout. Please check: 1) SMTP settings are correct, 2) Port is 587, 3) Gmail App Password is used. The OTP may still be sent - check your email.' })
        } else if (error.message?.includes('SMTP') || error.message?.includes('smtp') || error.message?.includes('mail')) {
          setErrors({ email: 'SMTP configuration error. Please check your SMTP settings in Supabase dashboard.' })
        } else {
          setErrors({ email: error.message || 'Failed to send OTP. Please check console for details.' })
        }
        setIsLoading(false)
        return
      }

      // Store email in sessionStorage for OTP page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('reset_password_email', email)
      }

      // Success - redirect to OTP page
      setSuccessMessage('OTP has been sent to your email! Redirecting...')
      setTimeout(() => {
        router.push('/otp')
      }, 1500)
    } catch (err: any) {
      console.error('Forgot password error:', err)
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      })
      setIsLoading(false)
      
      if (err.message?.includes('timeout') || err.message?.includes('504') || err.message?.includes('retry') || err.message?.includes('Gateway')) {
        setErrors({ email: 'Email service timeout. Please verify: 1) SMTP toggle is ON, 2) Port is 587, 3) Gmail App Password is correct. Check Supabase logs for details.' })
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setErrors({ email: 'Network error. Please check your internet connection and try again.' })
      } else {
        setErrors({ email: err.message || 'Something went wrong. Please check browser console and Supabase logs for details.' })
      }
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSendOTP()
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] border border-slate-100 p-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Forgot Password</h2>
          <p className="text-sm text-slate-600 mt-1">
            Enter your email and we&apos;ll send you a One-Time Password to reset it.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email Address <span className="text-rose-600">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.toLowerCase())
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
              }}
              placeholder="name@company.com"
              className={`h-12 rounded-lg border focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 ${
                errors.email
                  ? 'border-rose-400 bg-rose-50 text-rose-700 placeholder:text-rose-400'
                  : 'border-slate-300'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold"
          >
            {isLoading ? 'Sending…' : 'Send OTP'}
          </Button>

          {successMessage && (
            <p className="mt-2 text-center text-sm text-green-600">{successMessage}</p>
          )}
        </form>

        <div className="mt-4 text-center text-sm">
          Remembered your password?{' '}
          <Link href="/login" className="underline text-sky-600 hover:text-sky-700">
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}
