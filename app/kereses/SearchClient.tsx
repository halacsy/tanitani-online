'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface SearchItem {
  slug: string
  title: string
  authors: string[]
  date: string
  tags: string[]
  excerpt: string
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu')
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function SearchClient({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalize(query).trim()
  const results = useMemo(() => {
    const terms = normalizedQuery.split(/\s+/).filter(Boolean)
    if (terms.length === 0) return items.slice(0, 12)
    return items.filter(item => {
      const haystack = normalize([
        item.title,
        item.authors.join(' '),
        item.tags.join(' '),
        item.excerpt,
      ].join(' '))
      return terms.every(term => haystack.includes(term))
    })
  }, [items, normalizedQuery])

  return (
    <>
      <label htmlFor="archive-search" className="sr-only">Keresés a cikkarchívumban</label>
      <div className="relative mb-4">
        <input
          id="archive-search"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Cím, szerző, témakör vagy kifejezés…"
          className="w-full rounded-2xl border-2 border-line bg-white px-5 py-4 pr-14 font-sans text-base text-charcoal outline-none transition-colors focus:border-brand"
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl text-muted" aria-hidden="true">⌕</span>
      </div>

      <p className="font-sans text-sm text-muted mb-7" aria-live="polite">
        {normalizedQuery.length === 0
          ? 'A legfrissebb cikkek — kezdjen el gépelni a teljes archívum kereséséhez.'
          : `${results.length.toLocaleString('hu-HU')} találat`}
      </p>

      {results.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <h2 className="font-display text-xl font-semibold text-charcoal mb-2">Nincs találat</h2>
          <p className="font-sans text-sm text-muted">Próbáljon rövidebb vagy más kifejezést.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.slice(0, 80).map(item => (
            <article key={item.slug} className="bg-white border border-line rounded-xl p-5 card-lift">
              <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-muted mb-2">
                <span>{item.authors.join(', ')}</span>
                <span className="text-line">·</span>
                <time dateTime={item.date}>{formatDate(item.date)}</time>
              </div>
              <h2 className="font-display text-xl font-semibold leading-snug text-charcoal mb-2">
                <Link href={`/cikkek/${item.slug}`} className="hover:text-brand transition-colors">
                  {item.title}
                </Link>
              </h2>
              <p className="font-body text-sm leading-relaxed text-muted line-clamp-2 mb-3">
                {item.excerpt}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.slice(0, 4).map(tag => <span className="tag-pill" key={tag}>{tag}</span>)}
              </div>
            </article>
          ))}
          {results.length > 80 && (
            <p className="font-sans text-sm text-muted text-center py-4">
              Az első 80 találat látható. Szűkítse a keresést további kifejezéssel.
            </p>
          )}
        </div>
      )}
    </>
  )
}
