'use client'

import { Bell, Search } from 'lucide-react'
import { Profile } from '@/lib/types'

interface HeaderProps {
  title: string
  profile: Profile | null
}

export default function Header({ title, profile }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-xl font-semibold text-slate-800 ml-12 lg:ml-0">{title}</h1>
      <div className="flex items-center gap-3">
        {profile && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {profile.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-slate-700">{profile.nombre}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.rol}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
