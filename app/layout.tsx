import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://invertedworld.on.recursiv.io'),
  title: 'Inverted World Archive',
  description:
    'Topic-organized videos from Tales From the Inverted World with hourly live article feeds.',
  generator: 'Recursiv',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Inverted World Archive',
    description:
      'Topic-organized videos from Tales From the Inverted World with hourly live article feeds.',
    url: 'https://invertedworld.on.recursiv.io',
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
