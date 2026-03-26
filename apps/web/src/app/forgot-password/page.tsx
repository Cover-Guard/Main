'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      return
    }
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-brand-700">
            <Shield className="h-8 w-8" />
            <span className="text-2xl font-bold">CoverGuard</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-2 text-gray-500">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div className="card p-8">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 text-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Check your email</p>
                <p className="mt-1 text-sm text-gray-500">
                  We&apos;ve sent a password reset link. Check your inbox (and spam folder).
                </p>
              </div>
              <Link href="/login" className="mt-2 text-sm text-brand-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    className="input mt-1"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full py-2.5"
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
