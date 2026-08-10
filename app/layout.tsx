import type { Metadata, Viewport } from 'next'
import './globals.css'

const title = 'Corporate Life. On Loop.'
const description = 'A radio station for people stuck in back-to-back calls. Chai optional.'

export const metadata: Metadata = {
  // Swap for the real domain — WhatsApp/LinkedIn need an absolute URL for the preview image.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://corporate-life-on-loop.vercel.app'),
  title,
  description,
  openGraph: { title, description, images: ['/bg.webp'], type: 'website' },
  twitter: { card: 'summary_large_image', title, description, images: ['/bg.webp'] },
}

export const viewport: Viewport = {
  themeColor: '#2b2620',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
