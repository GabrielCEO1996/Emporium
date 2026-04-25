# Emporium

> Sistema de gestión integral para negocios de distribución B2B.

Emporium is a single-app ERP that covers the full distribution flow: catalog →
inventory (with FEFO lot tracking) → online checkout → orders →
invoices/credit-notes → payments → cash-flow & income-statement reporting.

Built with **Next.js 14 (App Router)** + **Supabase** (Postgres, Auth, RLS,
Storage). Deployed on **Vercel**.

---

## Modules

| Module | What it does |
|---|---|
| **Productos / Inventario** | Catalog with multi-presentación SKUs, lot tracking, FEFO consumption, expiry alerts. |
| **Clientes** | B2B customer book with credit lines, global discount %, smart price memory per cliente. |
| **Tienda (online checkout)** | App-user-facing storefront. Comprador pays via Stripe / Zelle / Cheque; cliente autorizado adds Efectivo + Crédito. |
| **Órdenes** | Pre-pedido state for online orders awaiting admin verification (Zelle proofs, cash-on-delivery, etc.). |
| **Pedidos** | Internal order pipeline: borrador → confirmado → preparada → despachada → entregada. |
| **Facturas** | Auto-generated from pedidos. Multi-pago support, credit-line consumption, ledger ingreso. |
| **Notas de crédito** | Refund/return flow with inventory restore + ledger reversal. |
| **Compras** | Supplier purchase orders. Receipt updates inventario + records `tipo='costo'` ledger entry. |
| **Gastos operativos** | Operating expenses (rent, payroll, marketing). Records `tipo='gasto'` ledger entry. |
| **Finanzas** | Income statement: Ingresos – COGS – Gastos = Utilidad neta. Cash flow chart. |
| **Reportes** | Year-to-date sales, top productos/clientes, descuentos analysis. |
| **Equipo** | Staff management (admin / vendedor / conductor / pendiente). |

### Roles

- **`admin`** — full access. Manages catalog, customers, accounting.
- **`vendedor`** — staff selling. Can run venta directa, create pedidos, manage own facturas.
- **`comprador`** — online buyer. Stripe / Zelle / Cheque only — no efectivo.
- **`cliente`** — authorized B2B with credit. Stripe + Zelle + Cheque + Efectivo
  (cash on delivery) + Crédito.
- **`conductor`** — driver. Sees assigned routes only.
- **`pendiente`** — vendor application not yet approved.

---

## Local development

### 1. Prerequisites

- **Node.js 20+** (anything below has Edge runtime issues)
- A **Supabase project** (free tier works) with the schema applied — see
  `supabase/schema.sql` and the migration files under `supabase/`
- A **Stripe account** in test mode (optional — checkout disables itself if
  the key is missing)
- A **Resend account** for transactional emails (optional)

### 2. Install + env

```bash
git clone https://github.com/GabrielCEO1996/Emporium.git
cd Emporium
npm install
cp .env.example .env.local
# Edit .env.local with your real values — see "Environment variables" below
```

### 3. Apply Supabase migrations (one-time)

The `supabase/` folder holds idempotent SQL migrations. Apply them in
roughly this order via the Supabase dashboard SQL editor (or
`supabase db execute --file <path>`):

```text
schema.sql              # core tables
rls_policies.sql        # row-level security
restructure_productos_inventario.sql
inventario.sql
lotes_fefo.sql          # FEFO lot tracking
stock_reservado.sql
proveedores.sql
compras.sql
compras_simplify.sql
ordenes.sql
checkout_v2.sql         # online checkout
payment_proofs.sql
pagos.sql
pagos_multimetodo.sql
pagos_usa_methods.sql
transacciones.sql       # ledger
contabilidad_v1.sql     # costos vs gastos separation
credito.sql             # credit lines + usar_credito RPC
cliente_user_link.sql   # link clientes ↔ profiles
cliente_app_profile.sql
comprador_role.sql
fix_roles_and_trigger.sql
activity_logs.sql
precios_inteligentes.sql # global discount + price memory
indexes_v2.sql           # composite indexes (performance)
sequences_serializable.sql # numero race-condition fix
```

If you're starting fresh, `schema.sql` + the post-launch ones are usually
enough. The `major_fix.sql` and `cancel_test_orders.sql` files are
historical — don't run them on a clean install.

### 4. Run

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check
```

---

## Environment variables

See [`.env.example`](./.env.example) for the canonical list. Required:

| Var | Where to get it | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API (server-only — never commit) | ✅ |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://emporium.example.com` (used by emails + Stripe redirects) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | optional (checkout disabled without it) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → endpoint signing secret | optional |
| `RESEND_API_KEY` | resend.com → API Keys | optional (emails skipped without it) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | optional (AI catalog chat disabled without it) |

---

## Architecture quick reference

- **`src/app/api/**`** — Next.js Route Handlers. Every handler is wrapped in
  `try/catch` with a sanitized 500 response (see commit `af428bd`).
- **`src/lib/supabase/`** — `server.ts` (RSC + route handlers), `client.ts`
  (client components), `middleware.ts` (cookie handling).
- **`src/lib/auth.ts`** — `requireUser`, `requireAdminOrVendedor`,
  `requireAdmin` gates. Use these in every API route.
- **`src/lib/fefo.ts`** — Lot allocation algorithm (oldest-non-expired first).
- **`src/lib/email/`** — Resend templates with HTML escaping.
- **`src/components/ui/ConfirmDialog.tsx`** — Imperative `showConfirm()` API
  used in place of `window.confirm()`.

### Stripe API version

Pinned to `2025-08-27.basil` (Stripe SDK ^18). Bumping to `dahlia` is a
deliberate billing-semantics decision — see `src/app/api/checkout/**` route
handlers.

### Activity log

Every state-changing API call writes to `activity_logs` via
`src/lib/security.ts → logActivity()`. Fire-and-forget (best-effort).

---

## Known operational tasks

After a fresh deploy, run these once on the Supabase project:

1. **Composite indexes** — `supabase/indexes_v2.sql`
2. **Sequence race fix** — `supabase/sequences_serializable.sql`
3. **Smart pricing** — `supabase/precios_inteligentes.sql`
4. **Costos/gastos split** — `supabase/contabilidad_v1.sql`

Each migration is idempotent (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE
FUNCTION`). Take a Supabase point-in-time snapshot first if running on
production data.

---

## Deployment (Vercel)

1. Connect the GitHub repo to a Vercel project.
2. Set the env vars from `.env.example` in **Project Settings → Environment
   Variables** (separately for **Production**, **Preview**, and
   **Development**).
3. Stripe webhook endpoint: point Stripe → Webhooks at
   `https://<your-domain>/api/webhook/stripe` and copy the signing secret
   into `STRIPE_WEBHOOK_SECRET`.
4. Push to `main` — Vercel deploys automatically.

The repo includes security headers (CSP, HSTS, X-Frame-Options) in
`next.config.mjs`. CSP allows Supabase + Stripe + Unsplash images.

---

## Production-readiness status (V1.0)

See [`CHANGELOG.md`](./CHANGELOG.md) for the audit-driven hardening waves.

| Phase | Status |
|---|---|
| TypeScript (0 errors) | ✅ |
| API try/catch coverage | ✅ |
| Stripe API version pinned | ✅ |
| Data integrity (factura/NC rollback, sequence locking) | ✅ |
| Database indexes | ✅ (apply migration on prod) |
| ConfirmDialog UX | ✅ |
| Tap targets | ✅ |
| PWA manifest + maskable icons | ✅ |
| Documentation | ✅ |
| Sentry / error tracking | ⏸ deferred until 5+ active clients |
| 405 `any` types in service layers | ⏸ tracked, low priority |

---

## License

Private. © Emporium.
