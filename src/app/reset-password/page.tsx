'use client'

// This page is kept for backward compatibility with any old reset-password links.
// New links go to /auth/reset-password via the /auth/callback handler.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordRedirect() {
  const router = useRouter()
  useEffect(() => {
    // Preserve the URL hash so /auth/reset-password can still pick up
    // any access_token that may be in the fragment (legacy implicit flow).
    const hash = window.location.hash
    router.replace('/auth/reset-password' + hash)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
    </div>
  )
}
