'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import navigation from '@/public/navigation.json'

export default function Nav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')
    || (href === '/szerzokrol' && pathname.startsWith('/szerzok/'))

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-line"
      onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false)
          toggle.current?.focus()
        }
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" onClick={() => setMenuOpen(false)} className="flex flex-col leading-none shrink-0" aria-label="Taní-tani Online – Kezdőlap">
          <span className="font-display text-xl font-bold text-brand tracking-tight">Taní-tani</span>
          <span className="font-sans text-[0.65rem] text-muted tracking-widest uppercase">Online</span>
        </Link>
        <nav aria-label="Fő navigáció" className="hidden xl:flex items-center gap-1">
          {navigation.main.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={`font-sans text-sm px-3 py-3 rounded-full transition-colors ${active(href) ? 'font-medium text-brand bg-brand-light' : 'text-charcoal hover:bg-sand'}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={navigation.newsletter.href} className="hidden xl:inline-flex font-sans text-sm font-medium rounded-full bg-brand text-white px-4 py-3 hover:opacity-90">
            {navigation.newsletter.label}
          </a>
          <Link href={navigation.search.href} onClick={() => setMenuOpen(false)} aria-current={active(navigation.search.href) ? 'page' : undefined}
            className="font-sans text-sm text-brand font-medium px-2 py-3 rounded-full hover:bg-sand">
            Keresés
          </Link>
          <button ref={toggle} onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-controls="mobile-navigation"
            className="xl:hidden min-h-11 px-3 rounded-full border border-line font-sans text-sm text-charcoal">
            {menuOpen ? 'Bezárás' : 'Menü'}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-navigation" aria-label="Fő navigáció mobilon" className="xl:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line px-6 py-4 flex flex-col gap-1 bg-cream">
          {navigation.main.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active(href) ? 'page' : undefined}
              className={`font-sans text-base py-3 border-b border-line ${active(href) ? 'text-brand font-medium' : 'text-charcoal'}`}>
              {label}
            </Link>
          ))}
          <a href={navigation.newsletter.href} className="font-sans text-base font-medium text-brand py-3">{navigation.newsletter.label}</a>
          <div className="border-t border-line pt-3 mt-2 grid sm:grid-cols-2">
            {navigation.footer.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="font-sans text-sm text-charcoal py-3">{label}</Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
