import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { LocaleProvider } from '@/lib/i18n/locale-context'
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} bg-background`} suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        {/* Dev-only: reload on stale chunks. Placed at end of body to avoid
            conflicting with v0 sandbox head injection (hydration mismatch). */}
        {process.env.NODE_ENV !== 'production' && (
          <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var reloading = false;
  function scheduleReload() {
    if (reloading) return;
    reloading = true;
    var attempts = 0;
    var t = setInterval(function() {
      attempts++;
      fetch(location.href, { method: 'HEAD', cache: 'no-store' })
        .then(function(r) { if (r.ok || attempts > 30) { clearInterval(t); location.reload(); } })
        .catch(function() { if (attempts > 30) { clearInterval(t); location.reload(); } });
    }, 700);
  }
  function isChunkErr(msg) {
    return msg && (msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Failed to load chunk') !== -1);
  }
  window.addEventListener('error', function(e) { if (isChunkErr(e && e.message)) scheduleReload(); }, true);
  window.addEventListener('unhandledrejection', function(e) { if (isChunkErr(e && e.reason && String(e.reason))) scheduleReload(); });
  try {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws = new WebSocket(proto + '//' + location.host + '/_next/webpack-hmr?page=/_error');
    ws.onmessage = function(e) { try { var d = JSON.parse(e.data); if (d && d.action === 'reload') scheduleReload(); } catch(_) {} };
    ws.onclose = function() { scheduleReload(); };
  } catch(_) {}
})();
          ` }} />
        )}
      </body>
    </html>
  )
}
