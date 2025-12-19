import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import { GlobalBackground } from '@/components/GlobalBackground'
import { Navbar } from '@/components/Navbar'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const montserrat = Montserrat({ 
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1a1f',
}

export const metadata: Metadata = {
  title: 'FitTech - Твой личный фитнес помощник',
  description: 'Отслеживай тренировки, питание и прогресс с FitTech',
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'FitTech',
    statusBarStyle: 'default',
    capable: true,
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={montserrat.className}>
        <ServiceWorkerRegistration />
        <GlobalBackground />
        <Navbar />
        <div className="relative z-10 min-h-screen w-full">
          {children}
        </div>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </body>
    </html>
  )
}

