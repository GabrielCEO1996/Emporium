import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('productos')
    .select(`
      id, codigo, nombre, descripcion, categoria, imagen_url,
      presentaciones(
        id, nombre, precio, stock, stock_minimo, unidad, activo,
        inventario(stock_total, stock_reservado, stock_disponible, precio_venta, precio_costo)
      )
    `)
    .eq('activo', true)
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only return products with at least one active presentation with stock
  const filtered = (data ?? [])
    .filter((p: any) => p.presentaciones?.some((pr: any) => pr.activo))
    .map((p: any) => ({
      ...p,
      presentaciones: p.presentaciones
        .filter((pr: any) => pr.activo)
        .map((pr: any) => {
          // Prefer inventario values; fall back to legacy presentaciones columns.
          const inv = Array.isArray(pr.inventario) ? pr.inventario[0] : pr.inventario
          const stockDisponible = inv?.stock_disponible ?? pr.stock ?? 0
          const stockTotal = inv?.stock_total ?? pr.stock ?? 0
          const precioVenta = inv?.precio_venta && inv.precio_venta > 0 ? inv.precio_venta : (pr.precio ?? 0)

          return {
            ...pr,
            precio: precioVenta,
            stock_disponible: stockDisponible,
            stock_total: stockTotal,
            // Convenience flags for tienda UI
            agotado: stockDisponible <= 0,
            ultimas_unidades: stockDisponible > 0 && stockDisponible <= 5,
          }
        }),
    }))

  return NextResponse.json(filtered)
}
