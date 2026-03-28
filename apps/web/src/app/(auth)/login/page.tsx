'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, User, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

function IndividualLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirectTo') ?? '/dashboard'
  // Validate redirect is a safe relative path to prevent open redirect attacks
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard'
  const [error, setError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) { setError(error.message); return }
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function signInWithGoogle() {
    setError(null)
    setOauthLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      })
      if (error) { setError(error.message); setOauthLoading(false) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google sign-in.')
      setOauthLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-brand-900 p-12 lg:flex">
        <div className="flex items-center gap-3 text-white">
          <Shield className="h-9 w-9" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-1.5 text-sm text-brand-200">
            <User className="h-4 w-4" />
            Individual Portal
          </div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Know your property&apos;s<br />risk before you buy.
          </h1>
          <p className="mt-4 text-lg text-brand-300">
            Instantly understand flood, fire, earthquake, and wind risks for any US property — and see which carriers are actively writing policies.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Instant risk scores from FEMA, USGS & Cal Fire',
              'See which carriers are writing in your area',
              'Get insurance cost estimates upfront',
              'Save and compare properties side by side',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-brand-200">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-brand-500">&copy; {new Date().getFullYear()} CoverGuard. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                <User className="h-4 w-4 text-brand-700" />
              </div>
              <span className="text-sm font-semibold text-brand-700">Individual Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
            <p className="mt-1 text-sm text-gray-500">
              Are you an agent?{' '}
              <Link href="/agents/login" className="text-brand-600 hover:underline">Agent login &rarr;</Link>
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={oauthLoading || isSubmitting}
            className="btn-secondary mb-4 w-full py-2.5 gap-3"
          >
            <GoogleIcon />
            {oauthLoading ? 'Redirecting\u2026' : 'Continue with Google'}
          </button>

          <Divider />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="individual-email" className="label">Email</label>
              <input id="individual-email" type="email" autoComplete="email" className="input mt-1" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="individual-password" className="label">Password</label>
                <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input id="individual-password" type="password" autoComplete="current-password" className="input mt-1" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting || oauthLoading} className="btn-primary w-full py-2.5">
              {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            New to CoverGuard?{' '}
            <Link href="/register" className="text-brand-600 hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <IndividualLoginForm />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function Divider() {
  return (
    <div className="relative mb-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center text-xs text-gray-500">
        <span className="bg-white px-3">or sign in with email</span>
      </div>
    </div>
  )
}
