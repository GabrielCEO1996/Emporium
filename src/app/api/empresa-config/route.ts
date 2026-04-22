import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('empresa_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? {})
  } catch (err) {
    console.error('[GET /api/empresa-config]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden editar la configuración' }, { status: 403 })
    }

    const body = await request.json()
    const allowed = ['nombre', 'rif', 'direccion', 'telefono', 'email', 'logo_url', 'mensaje_factura']
    const updates: Record<string, string> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data: existing } = await supabase
      .from('empresa_config')
      .select('id')
      .limit(1)
      .maybeSingle()

    let result
    if (existing?.id) {
      const { data, error } = await supabase
        .from('empresa_config')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      const { data, error } = await supabase
        .from('empresa_config')
        .insert(updates)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[PUT /api/empresa-config]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
