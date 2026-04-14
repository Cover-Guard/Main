import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { Providers } from '@/components/Providers'
import './globals.css'

const inter = localFont({
  src: [
    {
      path: '../fonts/inter-latin.woff2',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: [
    '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
    'Helvetica Neue', 'Arial', 'sans-serif',
  ],
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
    // suppressHydrationWarning on <html> neutralizes React error #418 caused
    // by browser extensions (dark-mode toggles, Grammarly, password managers,
    // etc.) that inject classes or data-* attributes onto the root element
    // before React hydrates. It does NOT hide legitimate mismatches inside
    // the component tree — those still surface normally. This is the
    // standard Next.js App Router mitigation for extension-driven hydration
    // noise on <html>/<body>.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        {/* Skip-to-content link — first focusable element for keyboard/screen reader users (WCAG 2.4.1) */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  )
}
