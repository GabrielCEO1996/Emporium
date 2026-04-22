import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-03-31.basil',
})

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe no configurado. Agrega STRIPE_SECRET_KEY al .env.local' }, { status: 503 })
  }

  const { items, notas, direccion_entrega } = await req.json()

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  try {
    // Build Stripe line items from cart
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${item.productoNombre} — ${item.presentacionNombre}`,
          description: item.presentacionNombre,
        },
        unit_amount: Math.round(Number(item.precio) * 100), // price in cents
      },
      quantity: Number(item.cantidad),
    }))

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${siteUrl}/tienda/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/tienda/checkout/cancel`,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        user_email: user.email ?? '',
        notas: notas ?? '',
        direccion_entrega: direccion_entrega ?? '',
        items: JSON.stringify(items),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[api/checkout]', err)
    return NextResponse.json({ error: err.message ?? 'Error al crear sesión de pago' }, { status: 500 })
  }
}
