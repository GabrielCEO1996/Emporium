// ═══════════════════════════════════════════════════════════════════════════
// src/lib/stripe.ts
//
// Tiny helper to tell the rest of the app whether Stripe is usable.
//
// The tienda checkout instantiates a `Stripe(key ?? 'sk_test_placeholder')`
// up-front (so route handlers never throw at import time), which means the
// Stripe SDK swallows the placeholder until an API call happens. This
// function is the authoritative check — use it on both server and client
// (the client sees it via the `stripeEnabled` flag passed from /tienda/page).
// ═══════════════════════════════════════════════════════════════════════════

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return false
  // Ignore obvious placeholders committed to the repo
  if (key.includes('placeholder')) return false
  if (key === 'sk_test_placeholder') return false
  // Real Stripe keys start with sk_live_ or sk_test_ and are 50+ chars long
  if (!/^sk_(live|test)_/.test(key)) return false
  if (key.length < 20) return false
  return true
}
