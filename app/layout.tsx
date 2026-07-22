import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Dancing_Script } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { LocaleProvider } from '@/lib/i18n/locale-context'
import { ChunkErrorWatcher } from '@/components/chunk-error-watcher'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

// Script face used to render "typed" electronic signatures.
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-signature',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default:  'GridMind Capital',
    template: '%s | GridMind Capital',
  },
  description:
    'GridMind Capital — enterprise EPC project management platform for renewable energy. Manage solar, wind and hydrogen projects across the full gate lifecycle.',
  keywords: ['EPC', 'project management', 'renewable energy', 'solar', 'wind', 'hydrogen', 'stage gate', 'GREOS'],
  authors: [{ name: 'GridMind Capital' }],
  creator: 'GridMind Capital',
  metadataBase: new URL('https://gridmind-gules.vercel.app'),
  openGraph: {
    type:        'website',
    locale:      'en_US',
    url:         'https://gridmind-gules.vercel.app',
    siteName:    'GridMind Capital',
    title:       'GridMind Capital — EPC Project Management',
    description: 'Enterprise platform for managing solar, wind, and hydrogen EPC projects across the full G0–G9 gate lifecycle.',
    images: [
      {
        url:    '/icons/icon-512.png',
        width:  512,
        height: 512,
        alt:    'GridMind Capital',
      },
    ],
  },
  twitter: {
    card:        'summary',
    title:       'GridMind Capital',
    description: 'Enterprise EPC project management for renewable energy.',
    images:      ['/icons/icon-512.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'GridMind',
  },
  icons: {
    icon:  [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
  },
  robots: {
    index:  false,   // private enterprise app — do not index
    follow: false,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a192f' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${dancingScript.variable} bg-background`} suppressHydrationWarning>
      {/* suppressHydrationWarning on <head> prevents React from erroring on the
          v0 sandbox script (window.__V0_SANDBOX_ID__) that is injected into
          <head> server-side but differs on the client. */}
      <head suppressHydrationWarning />
      <body className="antialiased font-sans">
        <ChunkErrorWatcher />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
