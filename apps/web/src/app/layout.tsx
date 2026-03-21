import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CoverGuard — Property Insurability Intelligence',
    template: '%s | CoverGuard',
  },
  description:
    'Search any property to instantly understand flood, fire, earthquake, and crime risks — and estimate true insurance costs before you bid.',
  keywords: ['property insurance', 'home insurance estimate', 'flood risk', 'fire risk', 'real estate due diligence'],
  openGraph: {
    title: 'CoverGuard',
    description: 'Know the true insurance cost of any property before you bid.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
