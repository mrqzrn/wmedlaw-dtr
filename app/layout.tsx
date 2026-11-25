import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://timekeeping-dtr.vercel.app'),
  title: 'WMedlaw — Daily Time Record (DTR) & Timekeeping System',
  description: 'Flexible hourly timekeeping, daily time records (DTR), role-based access control, and payment status for WMedlaw.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WMedlaw DTR',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/wmedlaw_logo.jpeg',
    shortcut: '/wmedlaw_logo.jpeg',
    apple: '/wmedlaw_logo.jpeg',
  },
  openGraph: {
    title: 'WMedlaw — Daily Time Record (DTR) & Timekeeping System',
    description: 'Flexible hourly timekeeping, daily time records (DTR), role-based access control, and payment status for WMedlaw.',
    images: [{ url: '/wmedlaw_logo.jpeg', width: 512, height: 512, alt: 'WMedlaw Logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'WMedlaw — Daily Time Record (DTR) & Timekeeping System',
    description: 'Flexible hourly timekeeping, daily time records (DTR), role-based access control, and payment status for WMedlaw.',
    images: ['/wmedlaw_logo.jpeg'],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="min-h-screen min-h-[100svh] antialiased">
        {children}
      </body>
    </html>
  );
}
