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
  const { nombre, solicita_vendedor } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nombre !== undefined) updates.nombre = String(nombre).trim()
  if (solicita_vendedor !== undefined) updates.solicita_vendedor = Boolean(solicita_vendedor)
  if (solicita_vendedor === true) updates.rol = 'pendiente'

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
