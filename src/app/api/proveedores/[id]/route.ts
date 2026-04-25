import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado', status: 401 }
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return { error: 'Solo administradores', status: 403 }
  return { userId: user.id }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data, error } = await supabase
        .from('proveedores')
        .select(`*, productos(id, nombre, presentaciones(id, nombre, precio, stock))`)
        .eq('id', params.id)
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[GET /api/proveedores/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
      const auth = await requireAdmin(supabase)
      if ('error' in auth && auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }

      const body = await req.json()
      const allowed = [
        'nombre','empresa','telefono','email','whatsapp',
        'categoria','tiempo_entrega_dias','condiciones_pago',
        'calificacion','notas','ultima_compra_fecha','ultima_compra_monto','activo'
      ]
      const updates: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in body) updates[key] = body[key]
      }

      const { data, error } = await supabase
        .from('proveedores')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)

  } catch (err) {
    console.error('[PATCH /api/proveedores/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
      const auth = await requireAdmin(supabase)
      if ('error' in auth && auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }

      // Soft delete
      const { error } = await supabase
        .from('proveedores')
        .update({ activo: false })
        .eq('id', params.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[DELETE /api/proveedores/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
