import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, Phone, Mail, MessageCircle,
  Star, Clock, CreditCard, FileText, Package
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props { params: { id: string } }

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-600'}`} />
      ))}
    </div>
  )
}

export default async function ProveedorDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') redirect('/dashboard')

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!proveedor) notFound()

  // Products linked to this supplier
  const { data: productosVinculados } = await supabase
    .from('productos')
    .select('id, nombre, categoria, presentaciones(id, nombre, precio, stock, activo)')
    .eq('proveedor_id', params.id)
    .eq('activo', true)
    .limit(20)

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/proveedores"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Proveedores
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {proveedor.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{proveedor.nombre}</h1>
              {proveedor.empresa && <p className="text-sm text-slate-500">{proveedor.empresa}</p>}
            </div>
          </div>
        </div>
        <Link
          href={`/proveedores/${params.id}/editar`}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap"
        >
          <Pencil className="w-4 h-4" /> Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {proveedor.telefono && (
              <a href={`tel:${proveedor.telefono}`} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                {proveedor.telefono}
              </a>
            )}
            {proveedor.email && (
              <a href={`mailto:${proveedor.email}`} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors truncate">
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                {proveedor.email}
              </a>
            )}
            {proveedor.whatsapp && (
              <a
                href={`https://wa.me/${proveedor.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm"
              >
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-all">
                  Escribir por WhatsApp
                </span>
              </a>
            )}
          </div>

          {proveedor.notas && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{proveedor.notas}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Calificación</span>
              <StarRating value={proveedor.calificacion} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Categoría</span>
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
                {proveedor.categoria ?? 'Sin categoría'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Entrega</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{proveedor.tiempo_entrega_dias} días</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-slate-500 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Pago</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 capitalize">{proveedor.condiciones_pago}</span>
            </div>
            {proveedor.ultima_compra_fecha && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Última compra</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDate(proveedor.ultima_compra_fecha)}</p>
                {proveedor.ultima_compra_monto && (
                  <p className="text-xs text-emerald-600 font-bold">{formatCurrency(proveedor.ultima_compra_monto)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linked products */}
      {productosVinculados && productosVinculados.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-500" />
            <h2 className="font-semibold text-sm text-slate-800 dark:text-white">
              Productos vinculados ({productosVinculados.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {productosVinculados.map(prod => (
              <div key={prod.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{prod.nombre}</p>
                  {prod.categoria && <p className="text-xs text-slate-400">{prod.categoria}</p>}
                </div>
                <Link
                  href={`/productos`}
                  className="text-xs text-teal-600 hover:underline font-medium"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
