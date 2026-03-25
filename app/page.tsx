import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'CoverGuard — Property Insurability Intelligence' }

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
          CoverGuard
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Property Insurability Intelligence — Search any property to instantly understand
          flood, fire, earthquake, and crime risks.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="/search"
            className="btn-primary px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start Searching
          </a>
          <a
            href="/agents/login"
            className="btn-secondary px-6 py-3 rounded-lg border border-input bg-background text-foreground hover:bg-accent transition-colors"
          >
            Agent Portal
          </a>
        </div>
      </div>
    </main>
  )
}
