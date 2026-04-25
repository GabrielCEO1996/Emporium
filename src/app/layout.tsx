import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import PWAInstallBanner from "@/components/pwa/PWAInstallBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "Emporium - Sistema de Distribución",
  description: "Sistema de gestión para negocios de distribución",
  manifest: '/manifest.json',
  icons: { icon: '/icon', apple: '/apple-icon' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Emporium',
    startupImage: [],
  },
  // `appleWebApp.capable: true` already emits both
  // `apple-mobile-web-app-capable` and `mobile-web-app-capable` meta tags;
  // the `apple-touch-fullscreen` tag is deprecated by Apple. Both were
  // previously duplicated under `other`, which Next 15 typings reject.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          {children}
          {/* Toasts at bottom-center so the cart icon (top-right of the
              tienda header) and the admin notification bell never get
              hidden by a "added to cart" / "saved" message. 3s is long
              enough to read but short enough to feel snappy. */}
          <Toaster
            richColors
            position="bottom-center"
            toastOptions={{ duration: 3000 }}
          />
          <ServiceWorkerRegistration />
          <PWAInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
