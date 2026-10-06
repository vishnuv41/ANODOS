'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-9 w-9" />
  const dark = resolvedTheme === 'dark'
  return (
    <button aria-label="Toggle theme" onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface/60 text-ink transition hover:bg-raised">
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
