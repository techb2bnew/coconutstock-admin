'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  role?: string
}

const VALID_ROLES = [
  'Super Admin',
  'Franchise Owner',
  'Warehouse Staff',
  'Branding Team',
  'Accounting Team',
  'Driver',
  'Customer',
]

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const router = useRouter()

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!name.trim()) newErrors.name = 'Name is required'

    if (!email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email'

    if (!password.trim()) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'

    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

    if (!role) newErrors.role = 'Please select a role'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSignUp = async () => {
    if (!validateForm()) return;
    setIsLoading(true);

    try {

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name,
            role,
          },
        },
      });

      if (error) {
        setErrors({ email: error.message });
        return;
      }

      const user = data.user;

      if (user) {
        const { error: insertError } = await supabase.from('users').insert([
          {
            id: user.id,
            name: name,
            email: email,
            role: role,
            created_at: new Date(),
          },
        ]);

        if (insertError) {
          console.error('Error inserting user profile:', insertError.message);
        }


        router.push('/login?signup=success');
      }
    } catch (err) {
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSignUp()
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] border border-slate-100 p-8">
        {/* Brand */}
        <div className="flex items-center gap-4 mb-6">
          {/* Image */}
          <div className="flex items-center justify-center rounded-full ring-4 ring-sky-100 overflow-hidden bg-white">
            <Image
              src="/assests/logos/coconut.png"
              alt="Brand"
              width={100}
              height={100}
              className="object-contain p-2"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col justify-center">
            <p className="text-sky-500 font-semibold leading-tight">Coconut Admin</p>
            <p className="text-[12px] text-slate-500 leading-none">
              Multi-Location System
            </p>
          </div>
        </div>


        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-sky-500">Create Your Account</h2>
          <p className="text-sm text-slate-600 mt-1">
            Sign up to access your admin dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Full Name <span className="text-rose-600">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
              }}
              placeholder="Enter ur name "
              className={`h-12 rounded-lg border focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 ${errors.name
                  ? ''
                  : 'border-slate-300'
                }`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
          </div>

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
              placeholder="Enter ur email"
              className={`h-12 rounded-lg border focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 ${errors.email
                  ? ''
                  : 'border-slate-300'
                }`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
          </div>

          {/* Role Dropdown */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Select Role <span className="text-rose-600">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value)
                if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }))
              }}
              className={`w-full h-12 rounded-lg border px-3 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 ${errors.role
                  ? ''
                  : 'border-slate-300 text-slate-800'
                }`}
            >
              <option value="">-- Select a Role --</option>
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {errors.role && <p className="mt-1 text-xs text-rose-600">{errors.role}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Password <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                }}
                placeholder="Enter your password"
                className={`pr-10 h-12 rounded-lg border focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 ${errors.password
                    ? ''
                    : 'border-slate-300'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm Password <span className="text-rose-600">*</span>
            </label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }}
              placeholder="Re-enter your password"
              className={`h-12 rounded-lg border focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:border-sky-500 ${errors.confirmPassword
                  ? ''
                  : 'border-slate-300'
                }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold"
          >
            {isLoading ? 'Creating account…' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline text-sky-600 hover:text-sky-700">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
