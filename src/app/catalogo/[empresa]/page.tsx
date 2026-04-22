import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MessageCircle, Package, ShoppingCart, Phone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props { params: { empresa: string } }

export const dynamic = 'force-dynamic'

function buildWhatsAppUrl(whatsapp: string, productoNombre: string, presentacionNombre: string, precio: number, empresaNombre: string): string {
  const numero = whatsapp.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Hola! Me interesa pedir *${productoNombre} — ${presentacionNombre}* ($${precio.toFixed(2)}) del catálogo de ${empresaNombre}. ¿Tienen disponibilidad?`
  )
  return `https://wa.me/${numero}?text=${msg}`
}

export default async function CatalogoPage({ params }: Props) {
  const supabase = createClient()

  // Get empresa config - match by nombre slug (lowercase, no spaces)
  const { data: config } = await supabase
    .from('empresa_config')
    .select('*')
    .limit(1)
    .maybeSingle()

  // We accept any slug and just show the catalog (single-tenant app)
  if (!config) notFound()

  const { data: productos } = await supabase
    .from('productos')
    .select(`
      id, nombre, descripcion, categoria, imagen_url,
      presentaciones(id, nombre, precio, stock, activo)
    `)
    .eq('activo', true)
    .order('nombre')

  const productosConStock = (productos ?? []).map(p => ({
    ...p,
    presentaciones: (p.presentaciones ?? []).filter((pr: any) => pr.activo),
  })).filter(p => p.presentaciones.length > 0)

  // Group by categoria
  const categorias = [...new Set(productosConStock.map(p => p.categoria ?? 'General'))].sort()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50">
      {/* Header */}
      <div className="bg-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.nombre} className="h-14 w-14 rounded-xl object-contain bg-white p-1" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                <Package className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{config.nombre ?? 'Catálogo'}</h1>
              <p className="text-teal-100 text-sm mt-0.5">
                {productosConStock.length} producto{productosConStock.length !== 1 ? 's' : ''} disponibles
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {config.telefono && (
                <a href={`tel:${config.telefono}`} className="flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl transition">
                  <Phone className="w-4 h-4" /> {config.telefono}
                </a>
              )}
              {config.whatsapp && (
                <a href={`https://wa.me/${(config as any).whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 px-3 py-2 rounded-xl transition font-medium">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
              {(config as any).moneda_secundaria && (config as any).tasa_cambio && (
                <div className="hidden sm:flex items-center gap-1.5 text-sm bg-white/20 px-3 py-2 rounded-xl">
                  <span className="text-teal-100 text-xs">1 USD = {Number((config as any).tasa_cambio).toFixed(2)} {(config as any).moneda_secundaria}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
          <a href="#all" className="px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-600 text-white whitespace-nowrap">
            Todos
          </a>
          {categorias.map(cat => (
            <a key={cat} href={`#${cat}`} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700 whitespace-nowrap transition">
              {cat}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10" id="all">
        {productosConStock.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500">No hay productos disponibles en este momento.</p>
          </div>
        ) : categorias.map(cat => {
          const prods = productosConStock.filter(p => (p.categoria ?? 'General') === cat)
          if (prods.length === 0) return null
          return (
            <section key={cat} id={cat}>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-teal-600 rounded-full inline-block" />
                {cat}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {prods.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Image */}
                    <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-12 h-12 text-slate-200" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-2">{p.nombre}</h3>
                      {p.descripcion && (
                        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{p.descripcion}</p>
                      )}

                      {/* Presentations */}
                      <div className="space-y-2">
                        {(p.presentaciones as any[]).map((pres: any) => {
                          const disponible = (pres.stock ?? 0) > 0
                          const waUrl = config.whatsapp
                            ? buildWhatsAppUrl(config.whatsapp, p.nombre, pres.nombre, pres.precio, config.nombre ?? 'la empresa')
                            : ''

                          return (
                            <div key={pres.id} className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 truncate">{pres.nombre}</p>
                                <p className="text-sm font-bold text-teal-700">{formatCurrency(pres.precio)}</p>
                                {(config as any).moneda_secundaria && (config as any).tasa_cambio && (
                                  <p className="text-xs text-slate-400">
                                    {(pres.precio * Number((config as any).tasa_cambio)).toLocaleString('es-VE', { maximumFractionDigits: 0 })} {(config as any).moneda_secundaria}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${disponible ? 'bg-emerald-400' : 'bg-slate-300'}`} title={disponible ? 'En stock' : 'Sin stock'} />
                                {waUrl ? (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-xs font-semibold px-2 py-1 rounded-lg transition ${
                                      disponible
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none'
                                    }`}
                                  >
                                    Pedir
                                  </a>
                                ) : (
                                  <span className={`text-xs px-2 py-1 rounded-lg ${disponible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                    {disponible ? 'Disp.' : 'Agotado'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 py-5 text-center text-xs text-slate-400">
          {config.nombre} · {config.rif && `RIF: ${config.rif} · `}
          {config.direccion && `${config.direccion} · `}
          Catálogo generado con Emporium
        </div>
      </div>
    </div>
  )
}
