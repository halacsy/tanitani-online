import { getAllArticles, getAllTags } from '@/lib/content'
import ArticleArchive, { ARTICLES_PER_PAGE } from '../components/ArticleArchive'
import Link from 'next/link'

export const metadata = {
  title: 'Cikkek',
  description: 'A Taní-tani Online teljes, kereshető cikkarchívuma 2008-tól napjainkig.',
}

export default function CikkekPage() {
  const allArticles = getAllArticles()
  const articles = allArticles.slice(0, ARTICLES_PER_PAGE)
  const tags = getAllTags().slice(0, 20)

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-2">
            Cikkarchívum
          </h1>
          <p className="font-sans text-sm text-muted">
            {allArticles.length.toLocaleString('hu-HU')} cikk 2008-tól napjainkig
          </p>
        </div>
        <Link href="/kereses" className="btn-primary">Keresés az archívumban</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-8" aria-label="Népszerű témakörök">
        {tags.map(tag => (
          <Link
            key={tag}
            href={`/temakorok/${encodeURIComponent(tag)}`}
            className="font-sans text-sm px-3 py-1 rounded-full border-[1.5px] border-line text-charcoal bg-white hover:border-brand hover:text-brand transition-colors"
          >
            {tag}
          </Link>
        ))}
        <Link href="/temakorok" className="font-sans text-sm px-3 py-1 text-brand hover:underline">
          Minden témakör →
        </Link>
      </div>

      <ArticleArchive articles={articles} page={1} totalArticles={allArticles.length} />
    </div>
  )
}
