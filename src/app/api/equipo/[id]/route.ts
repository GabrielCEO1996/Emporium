import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single()
      if (profile?.rol !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden cambiar roles' }, { status: 403 })
      }

      const body = await req.json()
      const { rol, activo } = body

      const updates: Record<string, unknown> = {}
      if (rol !== undefined) updates.rol = rol
      if (activo !== undefined) updates.activo = activo

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', params.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[PATCH /api/equipo/[id]]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

}
