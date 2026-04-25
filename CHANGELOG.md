# Changelog

All notable changes to Emporium are documented here. Dates use ISO format
(YYYY-MM-DD); commit hashes are short SHAs from `main`.

The project follows pragmatic semver: `1.0.0` is the V1 production release
(in progress). Pre-1.0 entries are organized chronologically.

---

## [Unreleased] — Production-readiness pass · 2026-04-25

Audit-driven hardening before V1.0 launch. Every change in this section was
flagged in the production-readiness report and applied with build verification.

### Wave 4 — UX polish · `7e8d91a`

- **`ConfirmDialog`** component (`src/components/ui/ConfirmDialog.tsx`).
  Imperative `showConfirm({title, message, danger?})` API mirroring
  Sonner's toast pattern. Replaced **13** `window.confirm()` callsites
  across destructive actions (eliminar pedido/factura/compra/gasto/proveedor,
  marcar pagada, marcar enviada, aprobar orden, confirmar pago, recibir
  compra, entregar pedido).
- **Tap targets** raised to ≥40px on `NotificationBell` (32→40), Sidebar
  mobile nav links (added `min-h-[44px]`), and PWA install banner (36→40).
- Mounted the `ConfirmDialogHost` once at the dashboard layout root.

### Wave 3 — Data integrity · `7257c91`

- **`venta-directa` factura_items rollback**: if `factura_items.insert()`
  fails after the parent factura row was created, we now delete the factura
  + pedido_items + pedido instead of leaving a dangling empty-line factura.
- **`notas-credito` partial-failure handling**: replaced silent `Promise.all`
  inventory restore with per-item outcome tracking. Failures are logged with
  full context AND surfaced to the caller as `inventory_warnings: [...]` in
  the 201 response so the admin can flag NCs for manual reconciliation.
  Activity log captures the failure count.
- **`get_next_sequence` race fix** (`supabase/sequences_serializable.sql`):
  added `SELECT … FOR UPDATE` row lock before the UPDATE so concurrent
  callers serialize on the row instead of racing for the same valor. Header
  comment includes a backup-snapshot reference + concurrent-test recipe.

### Wave 2 — API resilience · `af428bd`

- Wrapped **55** unprotected API handlers across **34** route files in
  top-level `try/catch` with a sanitized `{ error: 'Error interno del
  servidor' }` 500 response. No more raw `error.message` leakage. Each
  catch logs context-tagged errors to Vercel runtime logs.
- Pre-existing inner try/catches (Stripe signature verification, RPC
  fire-and-forget) are preserved. The new wrapper is a safety net.

### Wave 1 — Mechanical hardening · `61d51bd`

- **Stripe SDK pinned to `^18`** (apiVersion `2025-08-27.basil`). Updated
  4 files; renamed `Stripe.CheckoutSession` → `Stripe.Checkout.Session`.
  TS errors went from 7 to 0.
  Why ^18 not ^17: ^17 ships `acacia`, ^18 ships `basil`, ^22+ ships
  `dahlia` — we explicitly stay on basil.
- **Compound indexes** (`supabase/indexes_v2.sql`):
  `idx_facturas_cliente_fecha`, `idx_inventario_pres_expiry`,
  `idx_clientes_user`. Idempotent.
- **`/api/pagos`**: now decrements `clientes.deuda_total` by saldo_pendiente
  after marking factura paid (was silently going stale). Wrapped in
  try/catch; sanitized error responses.
- **`/inventario` table**: nested lots-table now wraps in `overflow-x-auto`
  + `min-w-[640px]` so it scrolls instead of squishing on iPhone SE.
- **PWA manifest**: added 512×512 icon entries (any + maskable purposes)
  and `orientation: portrait-primary`.

### Audit report + initial cleanup · `b06c9b7`

- `tsconfig.json`: `target: es2017` (kills Set/MapIterator iteration errors).
- `lib/security.ts → logActivity`: two-arg `.then(success, failure)` instead
  of `.catch` on a `PromiseLike`.
- `app/layout.tsx`: removed deprecated `apple-touch-fullscreen` + duplicate
  `mobile-web-app-capable` from metadata.other.
- `clientes/[id]/page.tsx`: `safeArray<T>()` accepts `PromiseLike<...>`.
- UUID validation guard on `/api/clientes/[id]` `.or()` filter (PostgREST
  filter-injection mitigation).
- HTML escaping in `/api/email/factura` template (XSS in factura.notas
  + cliente fields).
- `globalDescuento` clamped to `[0, subtotal]` in factura POST.
- Sanitized 500s in `/api/clientes` GET.

---

## [Pre-V1] · 2026-04 → 2026-04-25

Earlier work, condensed by theme.

### Tienda checkout

- **`5f66a8f`** — Restored Efectivo (cash on delivery) for `rol='cliente'`
  in tienda checkout. Removed the cliente-specific 403 in `/api/tienda/pedido`.
- **`ed1d7a4`** — CTA reads "Generar orden" for deferred-payment methods
  (efectivo, zelle, cheque, crédito). Stripe keeps "Pagar con tarjeta".
- **`897cea9`** — Multi-step payment wizard with pre-order verification.
- **`5912ca0`** — Rol-based payment security + proof uploads + email alerts.
- **`9e7bdd5`** — 9 critical UX bugs across signup, checkout, catalog.

### Pricing intelligence

- **`1492432`** — B2B smart pricing: global discount % per cliente,
  `historial_precios_cliente` price memory per cliente/producto, and a
  3-tier price-context display in the cart (oficial / con descuento / última
  venta).

### Accounting redesign

- **`422f0ea`** — Costos vs gastos separation (`contabilidad_v1.sql`):
  `transacciones.tipo` now has `'costo'` (compras → inventory asset) vs
  `'gasto'` (operating expenses). New `gastos_operativos` table. Income
  statement shows Ingresos – COGS – Gastos = Utilidad neta. Five additional
  bug fixes shipped in the same commit.

### Robustness fixes (clientes)

- **`f2ec5d2`** — Fixed React #419 (non-serializable Lucide icon refs
  crossing the RSC boundary in `ClienteTabBar`). Now passes string icon
  names; component refs stay client-side.
- **`b3b4d1a`** — Cliente detail accepts either `clientes.id` OR
  `clientes.user_id` at every entry point (page, editar, GET/PUT/DELETE
  API, contexto API). Prevents 404s on legacy app-user links.
- **`3278732`** — Debounced search bar (300ms) + URL-persisted filters,
  `error.tsx` boundary on cliente detail, hardened data fetching with
  `safeArray()`.
- **`8e5cbeb`** — 6 UX bug fixes: product loader cap (9 → 350+ presentaciones
  via `range(0,999)`), tabs on cliente detail, context panel in pedido
  creation, clickable client names everywhere.

### Earlier groundwork

- **`2212267`** — Lotes / vencimiento FEFO + stock mínimo alerts.
- **`c2d6067`** — Rate limiting, indexes, services layer, Zod, skeletons.
- **`1e6306f`** — First security/performance/code-quality audit.
- **`2089527`** — Tienda redesign (luxury pharmacy aesthetic).
- **`01bc650`** — Linked pedido↔factura history, reliable state changes.

---

## How to read this file

- **Wave 1–4** above = the production-readiness audit pass tied to the V1
  launch checklist. Apply the SQL migrations in `supabase/` (see README
  "Known operational tasks") before relying on the wave-3 sequence fix.
- **Pre-V1** entries are grouped by theme rather than chronological — the
  full git log is canonical for archaeology.
- Each entry includes the commit hash so you can `git show <hash>` for
  the exact diff.
