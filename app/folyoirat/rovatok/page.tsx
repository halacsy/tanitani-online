import Link from 'next/link'
import { getAllArticles } from '@/lib/content'
import sections from '@/content/migrated/tanitani/sections.json'
import PeriodicalNav from '@/app/components/PeriodicalNav'

export const metadata = { title: 'A nyomtatott folyóirat rovatai' }

export default function PeriodicalSectionsPage() {
  const articles = getAllArticles()
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-10">
      <div className="order-2 lg:order-1"><PeriodicalNav currentSlug="rovatok" /></div>
      <div className="order-1 lg:order-2 min-w-0">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">A nyomtatott folyóirat rovatai</h1>
        <p className="font-body mb-6">A rovatokhoz tartozó, online elérhető írások.</p>
        <nav aria-label="Rovatválasztó" className="flex flex-wrap gap-3 mb-10">
          {sections.map(section => <a key={section.id} href={`#${section.slug}`} className="font-sans text-brand underline py-2">{section.name}</a>)}
        </nav>
        {sections.map(section => (
          <section key={section.id} id={section.slug} className="mb-10 scroll-mt-24">
            <h2 className="font-display text-2xl font-bold mb-3">{section.name}</h2>
            <ul className="divide-y divide-line">
              {articles.filter(article => article.sections.some(item => item.id === section.id)).map(article => (
                <li key={article.slug} className="py-3">
                  <Link href={`/cikkek/${article.slug}`} className="text-brand hover:underline">{article.title}</Link>
                  <p className="font-sans text-sm text-muted">{article.authors.map(author => author.name).join(', ')}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
