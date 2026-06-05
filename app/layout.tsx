import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AdSenseLoader } from '@/components/ads/adsense-loader'
import './globals.css'

const siteTitle = 'Inverted World'
const siteDescription =
  "Inverted World is a mystery-driven independent media network that investigates the strange forces and hidden stories beneath everyday life. From UFO encounters, cryptids, ghosts, inter-dimensional beings, and secret government experiments to breaking news, fringe history, and unexplained phenomena. Tales From the Inverted World hosted by Shane Cashman explores the questions mainstream outlets often ignore. Featured on Tim Pool's independent media network Timcast, Inverted World delivers original reporting, deep investigations, and compelling stories for audiences searching for truth beyond the official narrative. Visit Inverted.World for the latest episodes, investigations, and breaking news from the edge of the unknown."

export const metadata: Metadata = {
  metadataBase: new URL('https://www.inverted.world'),
  title: siteTitle,
  description: siteDescription,
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
    // Same image as the SEO / social share card.
    icon: '/images/inverted-world-logo.jpg',
    shortcut: '/images/inverted-world-logo.jpg',
    apple: '/images/inverted-world-logo.jpg',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: 'https://www.inverted.world',
    siteName: 'Inverted World',
    images: ['/images/inverted-world-logo.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
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
        <AdSenseLoader />
      </body>
    </html>
  )
}
