import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre, email, rol, solicita_vendedor')
    .eq('id', user.id)
    .single()

  return NextResponse.json(profile)
}

export async function PUT(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, solicita_vendedor, telefono, whatsapp, direccion } = body

  // ── Update profiles table ────────────────────────────────────────────────
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nombre !== undefined) profileUpdates.nombre = String(nombre).trim()
  if (solicita_vendedor !== undefined) profileUpdates.solicita_vendedor = Boolean(solicita_vendedor)
  if (solicita_vendedor === true) profileUpdates.rol = 'pendiente'

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', user.id)
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // ── Update clientes table (if a record exists linked by email) ───────────
  const hasClienteUpdate = telefono !== undefined || whatsapp !== undefined || direccion !== undefined
  if (hasClienteUpdate) {
    const clienteUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (telefono !== undefined) clienteUpdates.telefono = String(telefono).trim() || null
    if (whatsapp !== undefined) clienteUpdates.whatsapp = String(whatsapp).trim() || null
    if (direccion !== undefined) clienteUpdates.direccion = String(direccion).trim() || null

    // Only update if a matching clientes record exists (by email)
    await supabase
      .from('clientes')
      .update(clienteUpdates)
      .eq('email', user.email ?? '')
  }

  return NextResponse.json(profileData)
}
