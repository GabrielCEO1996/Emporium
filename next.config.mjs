/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking — deny all iframe embedding
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer info sent cross-origin
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()' },
  // Force HTTPS for 2 years (only effective in production)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // XSS filter (legacy browsers)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // DNS prefetch
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Content Security Policy — tightened but Supabase / Unsplash / Stripe compatible
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline + Stripe
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      // Styles: self + inline (Tailwind generates inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Supabase storage + Unsplash + data URIs
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
      // Fonts: self
      "font-src 'self'",
      // API connections: self + Supabase + Stripe
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      // Frames: Stripe only
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // No plugins ever
      "object-src 'none'",
      // Base URI: self only
      "base-uri 'self'",
      // Form submissions: self only
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  typescript: { ignoreBuildErrors: true },

  async headers() {
    return [
      // Apply security headers to every route
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // API routes: no caching, explicit content-type
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // Service worker
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // PWA manifest
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
}

export default nextConfig
