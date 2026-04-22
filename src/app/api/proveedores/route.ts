import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const body = await req.json()
  const {
    nombre, empresa, telefono, email, whatsapp,
    categoria, tiempo_entrega_dias, condiciones_pago,
    calificacion, notas, ultima_compra_fecha, ultima_compra_monto
  } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const { data, error } = await supabase.from('proveedores').insert({
    nombre: nombre.trim(),
    empresa: empresa?.trim() || null,
    telefono: telefono?.trim() || null,
    email: email?.trim() || null,
    whatsapp: whatsapp?.trim() || null,
    categoria: categoria?.trim() || null,
    tiempo_entrega_dias: tiempo_entrega_dias ?? 1,
    condiciones_pago: condiciones_pago ?? 'contado',
    calificacion: calificacion ?? 5,
    notas: notas?.trim() || null,
    ultima_compra_fecha: ultima_compra_fecha || null,
    ultima_compra_monto: ultima_compra_monto ?? null,
    activo: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
