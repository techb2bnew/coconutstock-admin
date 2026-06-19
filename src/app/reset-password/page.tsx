'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)

  const router = useRouter()

  // Security: Check if OTP was verified before allowing password reset
  // Strict check: Both session AND sessionStorage flag required
useEffect(() => {
  const checkOtpVerification = () => {
    if (typeof window === 'undefined') return

    // ✅ Check if password was already reset (one-time use)
    const passwordResetUsed = sessionStorage.getItem('password_reset_used')
    if (passwordResetUsed === 'true') {
      setError('This password reset link has already been used. Please request a new OTP.')
      setTimeout(() => router.push('/forgot-password'), 2000)
      return
    }

    // ✅ Check OTP verification timestamp (15 min validity)
    const otpTimestamp = sessionStorage.getItem('otp_verified_timestamp')
    if (otpTimestamp) {
      const timestamp = parseInt(otpTimestamp, 10)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        setError('OTP verification has expired. Please request a new OTP.')
        sessionStorage.removeItem('otp_verified')
        sessionStorage.removeItem('otp_verified_timestamp')
        sessionStorage.removeItem('reset_password_email')
        setTimeout(() => router.push('/forgot-password'), 2000)
        return
      }
    }

    // ✅ Check OTP verified flag
    const otpVerified = sessionStorage.getItem('otp_verified')
    if (!otpVerified || otpVerified !== 'true') {
      setError('Unauthorized access. Please verify OTP first.')
      setTimeout(() => router.push('/forgot-password'), 2000)
      return
    }

    // ✅ All checks passed
    setIsCheckingAccess(false)
  }

  checkOtpVerification()
}, [router])

  const validateForm = (): boolean => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('All fields are required.')
      return false
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return false
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    setError(null)
    return true
  }

const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (!validateForm()) return

  setIsLoading(true)
  setError(null)
  setSuccessMessage(null)

  try {
    // ✅ Email sessionStorage se lo (Supabase session nahi hai ab)
    const userEmail = typeof window !== 'undefined'
      ? sessionStorage.getItem('reset_password_email')
      : null

    if (!userEmail) {
      setError('Session expired. Please login again.')
      setIsLoading(false)
      return
    }

    // ✅ Password update via server-side API (admin client se)
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: newPassword }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to reset password.')
      setIsLoading(false)
      return
    }

    // ✅ sessionStorage clear karo
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('password_reset_used', 'true')
      sessionStorage.removeItem('otp_verified')
      sessionStorage.removeItem('otp_verified_timestamp')
      sessionStorage.removeItem('reset_password_email')
    }

    setSuccessMessage('Password reset successful! Redirecting to login...')
    setTimeout(() => router.push('/login'), 1500)

  } catch (err) {
    console.error('Password reset error:', err)
    setError('Something went wrong. Please try again.')
  } finally {
    setIsLoading(false)
  }
}

  // Show loading while checking access
  if (isCheckingAccess) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] border border-slate-100 p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying access...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] border border-slate-100 p-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
          <p className="text-sm text-slate-600 mt-1">
            Enter your new password below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handlePasswordReset} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              New Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-12 rounded-lg border border-slate-300 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
              >
                {showNewPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-12 rounded-lg border border-slate-300 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}
          {successMessage && <p className="text-xs text-green-600">{successMessage}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold"
          >
            {isLoading ? 'Updating…' : 'Reset Password'}
          </Button>
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
