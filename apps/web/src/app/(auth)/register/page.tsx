'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NDA_TEXT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of account creation between CoverGuard, Inc. ("Company") and the individual registering for access to the CoverGuard platform ("User").

1. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public information disclosed by the Company through the CoverGuard platform, including but not limited to: proprietary risk scoring methodologies and algorithms, carrier availability data, underwriting intelligence, property insurability assessments, pricing models, system architecture and technical documentation, security protocols, business processes, and any data, analyses, compilations, or derivative works therefrom — whether disclosed in written, oral, electronic, or visual form.

2. OBLIGATIONS. User agrees to: (a) hold all Confidential Information in strict confidence using at least the same degree of care User uses to protect their own confidential information, but no less than reasonable care; (b) not disclose Confidential Information to any third party without the Company's prior written consent; (c) use Confidential Information solely for User's personal property research and decision-making purposes as permitted by the Platform; (d) not reproduce, distribute, reverse-engineer, decompile, or commercialize any Confidential Information; (e) promptly notify the Company in writing upon becoming aware of any unauthorized disclosure, access, or use of Confidential Information; and (f) cooperate with the Company to mitigate any harm resulting from unauthorized disclosure.

3. PERMITTED USE. User may access and use the Platform's data outputs solely for lawful personal or professional real estate due diligence. Any systematic extraction, scraping, automated collection, resale, redistribution, sublicensing, or commercial exploitation of the data is strictly prohibited.

4. DATA HANDLING. User shall not store Confidential Information on unsecured devices or systems, transmit Confidential Information over unencrypted channels, or commingle Confidential Information with data from other sources in a manner that could compromise its confidentiality. Upon termination of this Agreement or at the Company's written request, User shall promptly return or securely destroy all Confidential Information in their possession and certify such destruction in writing if requested.

5. NO WARRANTY. The Company makes no representation or warranty that any information provided is complete, accurate, or current. All risk assessments and insurance estimates are informational only and do not constitute professional insurance, financial, or legal advice.

6. TERM. This Agreement remains in effect for the duration of User's access to the Platform and for a period of five (5) years following termination of access, regardless of the reason for termination.

7. REMEDIES. User acknowledges that unauthorized disclosure of Confidential Information may cause irreparable harm to the Company that cannot be adequately compensated by monetary damages alone. The Company shall be entitled to seek injunctive relief and other equitable remedies in addition to all other remedies available at law or in equity, without the requirement of posting a bond.

8. LEGAL COMPLIANCE. Nothing in this Agreement prohibits User from making disclosures required by applicable law, regulation, or court order, provided that User: (a) provides the Company with prompt written notice of such requirement (to the extent legally permitted); and (b) cooperates with the Company in seeking a protective order or other appropriate remedy to limit the scope of disclosure.

9. GOVERNING LAW. This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles. Any dispute arising under this Agreement shall be resolved in the state or federal courts located in Wilmington, Delaware.

By creating an account, User agrees to be bound by the terms of this Agreement.`

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
  role: z.enum(['BUYER', 'AGENT', 'LENDER']),
  company: z.string().optional(),
  agreeNDA: z.literal(true, { errorMap: () => ({ message: 'You must agree to the NDA' }) }),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'You must agree to the Terms of Use' }) }),
  agreePrivacy: z.literal(true, { errorMap: () => ({ message: 'You must agree to the Privacy Policy' }) }),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'BUYER' },
  })

  const role = watch('role')

  async function onSubmit(data: FormData) {
    setError(null)

    try {
      // 1. Register via API (creates Supabase auth user + profile)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      let json: Record<string, unknown>
      try {
        json = await res.json()
      } catch {
        setError('Server returned an invalid response. Please try again.')
        return
      }

      if (!json.success) {
        const errorObj = json.error as { message?: string } | undefined
        setError(errorObj?.message ?? 'Registration failed')
        return
      }

      // 2. Sign in immediately
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
      if (signInError) {
        setError('Account created but sign-in failed. Please sign in manually.')
        router.push('/login')
        return
      }

      // 3. Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function signUpWithGoogle() {
    setError(null)
    setOauthLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
        },
      })
      if (error) {
        setError(error.message)
        setOauthLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google sign-in.')
      setOauthLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-brand-700">
            <Shield className="h-8 w-8" />
            <span className="text-2xl font-bold">CoverGuard</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-2 text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
          </p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={signUpWithGoogle}
            disabled={oauthLoading || isSubmitting}
            className="btn-secondary mb-4 w-full py-2.5 gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {oauthLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="bg-white px-3">or create account with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name</label>
                <input className="input mt-1" {...register('firstName')} />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input mt-1" {...register('lastName')} />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" autoComplete="email" className="input mt-1" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input type="password" autoComplete="new-password" className="input mt-1" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <div>
              <label className="label">I am a…</label>
              <select className="input mt-1" {...register('role')}>
                <option value="BUYER">Home Buyer</option>
                <option value="AGENT">Real Estate Agent</option>
                <option value="LENDER">Lender / Underwriter</option>
              </select>
            </div>

            {(role === 'AGENT' || role === 'LENDER') && (
              <div>
                <label className="label">Company</label>
                <input className="input mt-1" {...register('company')} />
              </div>
            )}

            {/* NDA */}
            <div>
              <label className="label mb-1">Non-Disclosure Agreement</label>
              <div className="h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 whitespace-pre-wrap">
                {NDA_TEXT}
              </div>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  {...register('agreeNDA')}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-gray-700">
                  I have read and agree to the Non-Disclosure Agreement
                </span>
              </label>
              {errors.agreeNDA && <p className="mt-1 text-xs text-red-600">{errors.agreeNDA.message}</p>}
            </div>

            {/* Terms & Privacy checkboxes */}
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  {...register('agreeTerms')}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-gray-700">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700">
                    Terms of Use
                  </a>
                </span>
              </label>
              {errors.agreeTerms && <p className="mt-0.5 ml-6 text-xs text-red-600">{errors.agreeTerms.message}</p>}

              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  {...register('agreePrivacy')}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-gray-700">
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700">
                    Privacy Policy
                  </a>
                </span>
              </label>
              {errors.agreePrivacy && <p className="mt-0.5 ml-6 text-xs text-red-600">{errors.agreePrivacy.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting || oauthLoading} className="btn-primary w-full py-2.5">
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
