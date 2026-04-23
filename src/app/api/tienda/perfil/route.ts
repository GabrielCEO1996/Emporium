import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── GET /api/tienda/perfil ─────────────────────────────────────────────────
// Returns the authenticated user's profile merged with their linked cliente
// record (if any). Used by the tienda to decide whether to show the shipping
// registration form before the first order.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre, email, rol, solicita_vendedor')
    .eq('id', user.id)
    .single()

  // Prefer user_id link; fall back to email match for legacy rows.
  let cliente: any = null
  {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, whatsapp, direccion, ciudad, tipo_cliente, user_id, credito_autorizado, limite_credito, credito_usado')
      .eq('user_id', user.id)
      .maybeSingle()
    cliente = data
  }
  if (!cliente && user.email) {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, whatsapp, direccion, ciudad, tipo_cliente, user_id, credito_autorizado, limite_credito, credito_usado')
      .eq('email', user.email)
      .maybeSingle()
    cliente = data
  }

  const complete = !!(cliente?.telefono && cliente?.direccion)

  return NextResponse.json({ ...profile, cliente, complete })
}

// ─── PUT /api/tienda/perfil ─────────────────────────────────────────────────
// Updates profile fields and/or linked cliente fields.
// Body: { nombre?, solicita_vendedor?, telefono?, whatsapp?,
//         direccion?, ciudad?, tipo_cliente? }
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))
  const {
    nombre, solicita_vendedor,
    telefono, whatsapp, direccion, ciudad, tipo_cliente,
  } = body ?? {}

  // ── Update profiles table ────────────────────────────────────────────────
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nombre !== undefined)            profileUpdates.nombre = String(nombre).trim()
  if (solicita_vendedor !== undefined) profileUpdates.solicita_vendedor = Boolean(solicita_vendedor)
  if (solicita_vendedor === true)      profileUpdates.rol = 'pendiente'

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', user.id)
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // ── Update (or create) clientes row ──────────────────────────────────────
  const hasClienteUpdate =
    telefono !== undefined || whatsapp !== undefined || direccion !== undefined ||
    ciudad !== undefined || tipo_cliente !== undefined || nombre !== undefined

  if (hasClienteUpdate) {
    const clienteUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined)       clienteUpdates.nombre       = String(nombre).trim()
    if (telefono !== undefined)     clienteUpdates.telefono     = String(telefono).trim() || null
    if (whatsapp !== undefined)     clienteUpdates.whatsapp     = String(whatsapp).trim() || null
    if (direccion !== undefined)    clienteUpdates.direccion    = String(direccion).trim() || null
    if (ciudad !== undefined)       clienteUpdates.ciudad       = String(ciudad).trim() || null
    if (tipo_cliente !== undefined) clienteUpdates.tipo_cliente = String(tipo_cliente).trim() || null

    // Find linked cliente — by user_id first, then email.
    let clienteId: string | null = null
    {
      const { data } = await supabase
        .from('clientes').select('id').eq('user_id', user.id).maybeSingle()
      if (data) clienteId = (data as any).id
    }
    if (!clienteId && user.email) {
      const { data } = await supabase
        .from('clientes').select('id').eq('email', user.email).maybeSingle()
      if (data) {
        clienteId = (data as any).id
        // Backfill user_id for future lookups.
        await supabase
          .from('clientes').update({ user_id: user.id })
          .eq('id', clienteId).is('user_id', null)
      }
    }

    if (clienteId) {
      await supabase.from('clientes').update(clienteUpdates).eq('id', clienteId)
    } else {
      // No cliente row yet — create one now so admin sees this user.
      await supabase.from('clientes').insert({
        nombre: (clienteUpdates.nombre as string) || (profileData as any)?.nombre || user.email?.split('@')[0] || 'Cliente',
        email: user.email,
        user_id: user.id,
        activo: true,
        ...clienteUpdates,
      })
    }
  }

  return NextResponse.json(profileData)
}
