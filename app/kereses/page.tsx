import { getAllArticles } from '@/lib/content'
import SearchClient, { type SearchItem } from './SearchClient'

export const metadata = {
  title: 'Keresés',
  description: 'Keresés a Taní-tani Online teljes cikkarchívumában.',
}

export default function SearchPage() {
  const items: SearchItem[] = getAllArticles().map(article => ({
    slug: article.slug,
    title: article.title,
    authors: article.authors.map(author => author.name),
    date: article.date,
    tags: article.tags,
    excerpt: article.excerpt,
  }))

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
      <h1 className="font-display text-3xl md:text-5xl font-bold text-charcoal mb-3">
        Keresés az archívumban
      </h1>
      <p className="font-body text-base text-muted mb-8 max-w-2xl">
        Keresés {items.length.toLocaleString('hu-HU')} cikk címében, szerzői között, témaköreiben és összefoglalójában.
      </p>
      <SearchClient items={items} />
    </div>
  )
}
