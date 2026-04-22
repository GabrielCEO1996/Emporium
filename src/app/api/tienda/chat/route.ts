import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { messages, productos } = await req.json()

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Mensajes requeridos' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  // Build catalogue context
  const catalogoTexto = Array.isArray(productos) && productos.length > 0
    ? productos.map((p: any) => {
        const pres = (p.presentaciones ?? [])
          .map((pr: any) => `  - ${pr.nombre}: Bs. ${pr.precio} (stock: ${pr.stock})`)
          .join('\n')
        return `• ${p.nombre}${p.categoria ? ` [${p.categoria}]` : ''}:\n${pres}`
      }).join('\n')
    : 'Catálogo no disponible'

  const systemPrompt = `Eres EmporiumBot, el asistente de compras de Emporium.
Ayudas a los clientes a encontrar productos, hacer pedidos y resolver dudas.
Eres amable, conciso y hablas en español venezolano (usa "Bs." para precios).
Cuando el cliente quiera hacer un pedido, guíalo paso a paso.
Tienes acceso al catálogo de productos disponibles:

${catalogoTexto}

Responde siempre en español. Sé breve y directo. Si no sabes algo, dilo con honestidad.
No inventes precios ni productos que no están en el catálogo.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return NextResponse.json({ error: (err as any).error?.message ?? 'Error de IA' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? 'Lo siento, no pude procesar tu mensaje.'
    return NextResponse.json({ reply: text })
  } catch (e) {
    console.error('[tienda/chat]', e)
    return NextResponse.json({ error: 'Error al conectar con IA' }, { status: 500 })
  }
}
