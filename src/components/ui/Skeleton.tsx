/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Skeleton — reusable loading placeholders.
 *
 * Used from route-level loading.tsx files (Next.js App Router convention).
 * All skeletons use the same slate-gray pulse animation for visual consistency.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cn } from '@/lib/utils'

/**
 * Base pulsing bar. Compose larger shapes by stacking / nesting.
 *
 *   <Skeleton className="h-4 w-32" />
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/80',
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  )
}

/** Rectangular card with a small header + body lines. */
export function SkeletonCard({
  lines = 3,
  className,
}: { lines?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'h-3 w-1/2' : 'h-3 w-full'} />
      ))}
    </div>
  )
}

/** Compact stat card with label + big number. */
export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>
  )
}

/** Generic table skeleton: N header cells, `rows` body rows. */
export function SkeletonTable({
  columns = 5,
  rows = 10,
}: { columns?: number; rows?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3"
           style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-2/3" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 px-5 py-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className={c === 0 ? 'h-4 w-16' : 'h-3 w-full'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Chart placeholder with title + body. */
export function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  )
}

/** Full page wrapper: header row + 4 stat cards + table. */
export function SkeletonListPage({
  rows = 10,
  columns = 5,
  statCards = 4,
}: { rows?: number; columns?: number; statCards?: number }) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: statCards }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
        <SkeletonTable columns={columns} rows={rows} />
      </div>
    </div>
  )
}
