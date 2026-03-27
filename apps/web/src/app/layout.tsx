import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d1929' },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'CoverGuard — Property Insurability Intelligence',
    template: '%s | CoverGuard',
  },
  description:
    'Search any property to instantly understand flood, fire, earthquake, and crime risks — and estimate true insurance costs before you bid.',
  keywords: ['property insurance', 'home insurance estimate', 'flood risk', 'fire risk', 'real estate due diligence'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CoverGuard',
  },
  openGraph: {
    title: 'CoverGuard',
    description: 'Know the true insurance cost of any property before you bid.',
    type: 'website',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
