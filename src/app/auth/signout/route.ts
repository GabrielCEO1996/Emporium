import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const cleared: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(c => {
            cleared.push(c as (typeof cleared)[0])
            try { cookieStore.set(c.name, c.value, c.options as Parameters<typeof cookieStore.set>[2]) } catch { /* ignored */ }
          })
        },
      },
    }
  )

  await supabase.auth.signOut()

  // Build redirect and attach cleared cookies (so browser removes them)
  const { origin } = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  const res = NextResponse.redirect(`${appUrl}/login`)
  cleared.forEach(({ name, value, options }) =>
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
  )
  return res
}
