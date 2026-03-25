import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Property Search' }

export default function SearchPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">
          Property Search
        </h1>
        <p className="text-muted-foreground mb-8">
          Search for any US property to view flood, fire, earthquake, wind, and crime risk
          scores alongside active insurance carriers.
        </p>
        <div className="card p-6 text-left">
          <div className="input mb-4 cursor-not-allowed opacity-60">
            Enter an address, ZIP code, or parcel ID…
          </div>
          <p className="text-xs text-muted-foreground">
            Full search functionality is available in the deployed application.
          </p>
        </div>
        <a href="/" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </a>
      </div>
    </main>
  )
}
