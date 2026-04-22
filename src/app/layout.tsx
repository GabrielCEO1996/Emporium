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
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
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
          <Toaster
            richColors
            position="top-right"
            toastOptions={{ duration: 4000 }}
          />
          <ServiceWorkerRegistration />
          <PWAInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
