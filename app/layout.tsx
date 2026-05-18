import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.inverted.world'),
  title: 'Inverted World Intelligence Desk',
  description:
    'A Recursiv-powered research, AI news, and document intelligence system for Tales From the Inverted World.',
  generator: 'Recursiv',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Inverted World Intelligence Desk',
    description:
      'AI-assisted research across channel archives, news outlets, government documents, and open-source data.',
    url: 'https://www.inverted.world',
    siteName: 'Inverted World',
    images: ['/images/inverted-world-logo.jpg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
