---
name: crud-builder
description: Generates complete, production-ready CRUD modules for Emporium ERP. Always invokes app-architect first to analyze structure before generating any code. Given a module name and fields, creates all necessary files following architecture rules.
---

# CRUD Builder Skill — Emporium ERP

## Role
You are a senior full-stack engineer for Emporium ERP.
BEFORE generating any code, you MUST invoke /app-architect to:
- Analyze existing project structure
- Identify reusable components
- Define where new files should live
- Flag architectural risks

Only after /app-architect completes its analysis, you generate code.

## Pre-Flight Checklist (MANDATORY)
1. Invoke /app-architect — analyze project structure
2. Scan src/components/ui/ — identify reusable components
3. Check src/lib/types.ts — identify existing types
4. Scan existing modules (productos, clientes, facturas) as reference
5. Confirm module does NOT already exist
6. Only then start generating files

## Files to Generate (IN ORDER)

### 1. Type Definition
File: src/lib/types.ts (ADD to existing, never replace)
- Main entity type
- Form data type
- Filter params type
- Never use "any"

### 2. Database Queries
File: src/lib/supabase/[module].ts
- getAll(filters?) — list with filters
- getById(id) — single record
- create(data) — insert
- update(id, data) — update
- remove(id) — soft or hard delete
- Always typed, always try/catch

### 3. API Routes
File: src/app/api/[module]/route.ts → GET, POST
File: src/app/api/[module]/[id]/route.ts → GET, PATCH, DELETE
- Supabase server client
- Input validation
- Proper HTTP status codes
- Error messages in Spanish

### 4. Server Page
File: src/app/(dashboard)/[module]/page.tsx
- NO "use client" — server component
- Fetch initial data
- Pass to Client component as props
- Export metadata

### 5. Client Page
File: src/app/(dashboard)/[module]/[Module]Client.tsx
- "use client" at top
- Receives props from server page
- Local state management
- React Query for refetching
- Framer Motion animations (fadeIn, slideUp)

### 6. Form Component
File: src/components/[module]/[Module]Form.tsx
- "use client"
- CREATE and EDIT modes
- Input validation with Spanish error messages
- Loading state on submit
- Toast notifications (success/error)
- Reuse existing UI components

### 7. Table or Grid Component
File: src/components/[module]/[Module]Table.tsx
- "use client"
- Search and filter
- Action buttons per row (edit, delete)
- Empty state component
- Loading skeleton
- Pagination if > 20 records

### 8. Detail Page (when needed)
File: src/app/(dashboard)/[module]/[id]/page.tsx
- Server component
- Full record details
- Status change buttons

### 9. Sidebar Link
File: src/components/layout/Sidebar.tsx (MODIFY)
- Add route to navigation array
- Lucide React icon
- Admin-only flag if needed

### 10. SQL Migration
Generate complete CREATE TABLE SQL:
- UUID primary key with gen_random_uuid()
- All fields with correct PostgreSQL types
- Foreign key references
- created_at timestamptz DEFAULT now()
- updated_at timestamptz DEFAULT now()
- RLS disabled (matches project setup)

## Architecture Rules (from app-architect)
- page.tsx = server component (NO hooks, NO "use client")
- Client components = always "use client" at top
- Types = always in src/lib/types.ts
- Queries = always in src/lib/supabase/[module].ts
- Never duplicate existing components
- Mobile responsive with Tailwind breakpoints
- Colors: teal/green aguamarina (#0D9488, #0F766E, #F0FDFA)
- Animations with Framer Motion

## Code Quality Rules
- TypeScript strict — no "any"
- All async functions have try/catch
- Error messages in Spanish
- Loading AND empty states required
- Touch targets minimum 44px (mobile)
- Font size minimum 16px on inputs (prevents iOS zoom)

## Output Format
When invoked respond with:
1. ARCHITECTURE ANALYSIS — from /app-architect
2. MODULE PLAN — all files to create/modify
3. SQL — run this in Supabase first
4. FILES — each file with complete code
5. SIDEBAR — exact change in Sidebar.tsx
6. BUILD CHECK — confirm npm run build passes

## Usage
/crud-builder module=categorias fields=nombre:text,descripcion:text,color:text,activo:boolean

## Important
- ALWAYS run /app-architect first
- ALWAYS run npm run build after generating files
- NEVER skip files from the list above
- NEVER use "any" TypeScript type
- NEVER create duplicate components

DO NOT modify any existing code. Only create the skill file.
