import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.inverted.world'),
  title: 'Inverted World Archive',
  description:
    'Tales From the Inverted World investigates paranormal mysteries, UFO disclosure, declassified programs, strange history, and current coverage with videos, transcripts, source links, and documents.',
  keywords: [
    'Inverted World',
    'Tales From the Inverted World',
    'paranormal archive',
    'UFO disclosure',
    'UAP',
    'declassified documents',
    'conspiracy research',
    'cryptids',
    'MKULTRA',
    'Epstein files',
    'AI technocracy',
    'YouTube transcripts',
  ],
  generator: 'Recursiv',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Inverted World Archive',
    description:
      'Paranormal and conspiracy research archive with Tales From the Inverted World videos, transcripts, live news, and primary-source research links.',
    url: 'https://www.inverted.world',
    siteName: 'Inverted World',
    images: ['/images/inverted-world-logo.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inverted World Archive',
    description:
      'Paranormal and conspiracy research archive with videos, transcripts, live news, and primary-source research links.',
    images: ['/images/inverted-world-logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
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
