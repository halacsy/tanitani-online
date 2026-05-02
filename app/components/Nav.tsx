'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/cikkek', label: 'Cikkek' },
  { href: '/temakorok', label: 'Témakörök' },
  { href: '/szerzokrol', label: 'Szerzőkről' },
  { href: '/rolunk', label: 'Rólunk' },
]

export default function Nav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-line">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-xl font-bold text-brand tracking-tight">Taní-tani</span>
          <span className="font-sans text-[0.65rem] text-muted tracking-widest uppercase">Online</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`font-sans text-sm px-3 py-1.5 rounded-full transition-colors duration-150 ${
                  active
                    ? 'font-medium text-brand bg-brand-light'
                    : 'text-charcoal hover:bg-sand'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menü"
          className="sm:hidden p-2 text-charcoal"
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="18" y2="18" />
              <line x1="18" y1="4" x2="4" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="19" y2="6" />
              <line x1="3" y1="11" x2="19" y2="11" />
              <line x1="3" y1="16" x2="19" y2="16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-line px-6 py-4 flex flex-col gap-1 bg-cream">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`font-sans text-base py-2.5 border-b border-line last:border-0 ${
                  active ? 'text-brand font-medium' : 'text-charcoal'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
