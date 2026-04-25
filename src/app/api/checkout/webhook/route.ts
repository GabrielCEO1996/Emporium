import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
})

// Stripe requires the raw body for signature verification
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        return NextResponse.json({ error: 'Webhook secret no configurado' }, { status: 503 })
      }

      const signature = req.headers.get('stripe-signature')
      if (!signature) return NextResponse.json({ error: 'Sin firma' }, { status: 400 })

      const body = await req.text()
      let event: Stripe.Event

      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err: any) {
        return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
      }

      // Only handle successful checkout
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        const meta = session.metadata ?? {}
        const items = JSON.parse(meta.items ?? '[]')

        if (items.length > 0) {
          const supabase = createClient()

          // Find cliente by email
          const { data: clienteData } = await supabase
            .from('clientes')
            .select('id')
            .eq('email', meta.user_email ?? '')
            .maybeSingle()

          const { data: numData } = await supabase.rpc('get_next_sequence', { seq_name: 'pedidos' })
          const subtotal = items.reduce(
            (acc: number, item: any) => acc + Number(item.precio) * Number(item.cantidad), 0
          )

          const { data: pedido } = await supabase
            .from('pedidos')
            .insert({
              numero: numData,
              cliente_id: clienteData?.id ?? null,
              estado: 'confirmado',  // already paid!
              subtotal,
              descuento: 0,
              impuesto: 0,
              total: subtotal,
              notas: meta.notas || `Pagado vía Stripe. Session: ${session.id}`,
              direccion_entrega: meta.direccion_entrega || null,
            })
            .select()
            .single()

          if (pedido) {
            const pedidoItems = items.map((item: any) => ({
              pedido_id: pedido.id,
              presentacion_id: item.presentacion_id,
              cantidad: Number(item.cantidad),
              precio_unitario: Number(item.precio),
              descuento: 0,
              subtotal: Number(item.precio) * Number(item.cantidad),
            }))
            await supabase.from('pedido_items').insert(pedidoItems)
          }
        }
      }

      return NextResponse.json({ received: true })

  } catch (err) {
    console.error('[POST /api/checkout/webhook]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
