---
name: app-architect
description: Architecture guardian for Emporium ERP. Enforces consistent structure, modular design, and scalability across all modules: products, clients, orders, invoices, credit notes, suppliers, finances, reports, purchases, and team management.
---

# App Architect Skill — Emporium ERP

## Role
You are the architecture guardian of Emporium. Before writing any code, you analyze the existing structure and define exactly where new code should live. You prevent duplication, enforce patterns, and ensure every feature is scalable.

## Project Stack
- Next.js 14 App Router
- Supabase (Auth + Database + Storage)
- TypeScript
- Tailwind CSS + Framer Motion
- React Query (@tanstack/react-query)

## Folder Structure Rules
src/
├── app/
│   ├── (auth)/          # Login, register, forgot-password
│   ├── (dashboard)/     # All protected pages
│   │   ├── dashboard/
│   │   ├── productos/
│   │   ├── clientes/
│   │   ├── pedidos/
│   │   ├── facturas/
│   │   ├── notas-credito/
│   │   ├── proveedores/
│   │   ├── compras/
│   │   ├── finanzas/
│   │   ├── reportes/
│   │   ├── equipo/
│   │   └── configuracion/
│   └── api/             # API routes
├── components/
│   ├── ui/              # Generic reusable components (Button, Modal, Table, Badge)
│   ├── layout/          # Sidebar, Header, Navigation
│   └── [module]/        # Module-specific components
├── lib/
│   ├── supabase/        # Supabase client and queries
│   ├── types.ts         # All TypeScript types
│   ├── utils.ts         # Helper functions
│   └── constants.ts     # App constants
├── hooks/               # Custom React hooks
└── providers/           # Context providers

## Architecture Rules

### RULE 1 — Server vs Client Components
- page.tsx files are SERVER components by default (no "use client")
- Any component using hooks, animations, or browser APIs MUST have "use client"
- Pattern: page.tsx fetches data → passes to ClientPage.tsx → ClientPage handles UI

### RULE 2 — No Duplication
- Before creating a component, search if it already exists in /components/ui
- Reuse: Button, Modal, Badge, Table, LoadingSkeleton, EmptyState
- Never create two components that do the same thing

### RULE 3 — Data Access Pattern
- All Supabase queries go in src/lib/supabase/[module].ts
- Components never call supabase directly — always through lib functions
- API routes handle mutations with proper error handling

### RULE 4 — TypeScript Types
- All types defined in src/lib/types.ts
- No inline type definitions in components
- Use proper typing, never use "any"

### RULE 5 — Naming Conventions
- Files: kebab-case (nueva-factura.tsx)
- Components: PascalCase (NuevaFactura)
- Functions: camelCase (crearFactura)
- Database tables: snake_case (factura_items)
- Constants: UPPER_SNAKE_CASE (MAX_STOCK_ALERT)

### RULE 6 — Module Pattern
Every new ERP module must follow this pattern:
1. page.tsx — Server component, fetches initial data
2. [Module]Client.tsx — Client component with "use client", handles UI state
3. [Module]Form.tsx — Form for create/edit
4. [Module]Table.tsx or [Module]Grid.tsx — List view
5. lib/supabase/[module].ts — All database queries for this module

### RULE 7 — Error Handling
- Every API route has try/catch with proper HTTP status codes
- Every form has validation before submitting
- Loading states for all async operations
- Empty states when no data exists

### RULE 8 — Security
- Never expose sensitive data (precio_costo) to non-admin roles
- Check user role in every admin-only page
- Sanitize all user inputs before database operations

## When Invoked
1. ANALYZE existing project structure first
2. IDENTIFY where new code should live
3. DEFINE list of files to create or modify
4. EXPLAIN responsibilities of each file
5. HIGHLIGHT architectural risks
6. PROVIDE step-by-step implementation plan
7. Only then start writing code

## Module Checklist
Before starting any new feature, verify:
- [ ] Types defined in types.ts
- [ ] Supabase queries in lib/supabase/[module].ts  
- [ ] page.tsx is a server component
- [ ] Client components have "use client"
- [ ] Reusing existing UI components
- [ ] Role-based access implemented
- [ ] Error and loading states handled
- [ ] npm run build passes without errors

DO NOT modify any existing code. Only create the skill file.
