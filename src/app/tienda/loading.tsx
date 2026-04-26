/**
 * /tienda — Loading skeleton.
 *
 * Next.js App Router monta este componente automáticamente como Suspense
 * fallback mientras el server component (page.tsx) hace sus queries a
 * Supabase. Cubre el cold-start de Vercel (2-3s) entre que la animación
 * del Loader cinemático termina y el contenido real está listo.
 *
 * Layout mimetiza el del hero real: dos columnas en desktop, eyebrow +
 * title con shimmer + subtitle + CTAs apagados + meta column. El globo
 * 3D NO aparece aquí (es pesado y se monta en el client component) — lo
 * sustituye un disco shimmer del mismo radio, en la misma posición que
 * tendría el globo, así no hay shift de layout cuando el contenido real
 * llega.
 */

import './styles/tienda.css'

export default function TiendaLoading() {
  return (
    <div className="tienda-screen tienda-skeleton-root">
      {/* Eyebrow + Title + Subtitle + CTAs (column izquierda) */}
      <div className="tienda-skeleton-content">
        <div className="tienda-skeleton-line" style={{ width: '180px', height: '11px' }} />
        <div className="tienda-skeleton-block" style={{ marginTop: '24px' }}>
          <div className="tienda-skeleton-line" style={{ width: '60%', height: '64px' }} />
          <div
            className="tienda-skeleton-line"
            style={{ width: '40%', height: '64px', marginTop: '8px' }}
          />
        </div>
        <div className="tienda-skeleton-block" style={{ marginTop: '24px' }}>
          <div className="tienda-skeleton-line" style={{ width: '90%', height: '14px' }} />
          <div
            className="tienda-skeleton-line"
            style={{ width: '70%', height: '14px', marginTop: '6px' }}
          />
        </div>
        <div className="tienda-skeleton-actions" style={{ marginTop: '36px' }}>
          <div className="tienda-skeleton-pill" />
          <div
            className="tienda-skeleton-line"
            style={{ width: '110px', height: '12px' }}
          />
        </div>
      </div>

      {/* Globe placeholder (column derecha) — disco shimmer del mismo radio */}
      <div className="tienda-skeleton-globe" aria-hidden="true">
        <div className="tienda-skeleton-globe-disc" />
      </div>

      {/* Meta column (top right) */}
      <aside className="tienda-skeleton-meta" aria-hidden="true">
        <div className="tienda-skeleton-line" style={{ width: '120px', height: '10px' }} />
        <div
          className="tienda-skeleton-line"
          style={{ width: '180px', height: '24px', marginTop: '10px' }}
        />
        <div className="tienda-skeleton-divider" />
        <div className="tienda-skeleton-line" style={{ width: '100px', height: '10px' }} />
        <div
          className="tienda-skeleton-line"
          style={{ width: '160px', height: '24px', marginTop: '10px' }}
        />
      </aside>
    </div>
  )
}
