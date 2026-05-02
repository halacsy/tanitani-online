import Link from 'next/link'

const tagLinks = [
  'alternatív iskolák', 'drámapedagógia', 'hátrányos helyzet', 'IKT',
  'iskolakritika', 'kompetencia', 'oktatáspolitika', 'pedagógusok',
  'nevelés', 'romák', 'SNI', 'szabad nevelés',
]

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white/75 mt-16">
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-10">

          {/* Brand */}
          <div>
            <div className="font-display text-2xl font-bold text-white mb-2">
              Taní-tani Online
            </div>
            <p className="font-sans text-sm leading-relaxed">
              A szabad pedagógiai gondolkodás fóruma. Alapítva 1996-ban.
            </p>
          </div>

          {/* Nav links */}
          <div>
            <h4 className="font-sans text-xs font-medium tracking-widest uppercase text-white/50 mb-4">
              Tartalom
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { href: '/cikkek', label: 'Összes cikk' },
                { href: '/temakorok', label: 'Témakörök' },
                { href: '/szerzokrol', label: 'Szerzők' },
                { href: '/rolunk', label: 'Rólunk' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="font-sans text-sm text-white/75 hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="font-sans text-xs font-medium tracking-widest uppercase text-white/50 mb-4">
              Témakörök
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tagLinks.map(tag => (
                <Link
                  key={tag}
                  href={`/temakorok/${encodeURIComponent(tag)}`}
                  className="font-sans text-xs bg-white/10 text-white/75 hover:bg-white/20 transition-colors px-2.5 py-0.5 rounded-full"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="font-sans text-xs">© Taní-tani Online · Creative Commons licenc alatt</p>
          <p className="font-sans text-xs">Partnereink: Történelemtanárok Egylete · Magyar Pedagógiai Társaság</p>
        </div>
      </div>
    </footer>
  )
}
