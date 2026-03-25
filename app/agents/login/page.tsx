import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Agent Login' }

export default function AgentLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Portal</h1>
          <p className="text-muted-foreground mt-2">Sign in to your agent account</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="label mb-1">Email</label>
            <input className="input" type="email" placeholder="agent@brokerage.com" disabled />
          </div>
          <div>
            <label className="label mb-1">Password</label>
            <input className="input" type="password" placeholder="••••••••" disabled />
          </div>
          <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
            Sign In
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Full authentication available in the deployed application.
          </p>
        </div>
        <p className="text-center mt-4 text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground transition-colors">← Back to home</a>
        </p>
      </div>
    </main>
  )
}
