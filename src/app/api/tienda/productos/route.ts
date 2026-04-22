import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('productos')
    .select(`
      id, nombre, descripcion, categoria, imagen_url,
      presentaciones(id, nombre, precio, stock, stock_minimo, unidad, activo)
    `)
    .eq('activo', true)
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only return products that have at least one active presentation
  const filtered = (data ?? []).filter((p: any) =>
    p.presentaciones?.some((pr: any) => pr.activo)
  ).map((p: any) => ({
    ...p,
    presentaciones: p.presentaciones.filter((pr: any) => pr.activo),
  }))

  return NextResponse.json(filtered)
}
