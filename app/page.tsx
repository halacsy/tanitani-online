import { tagHref } from '@/lib/tags.mjs'
import Link from 'next/link'
import { getAllArticles, getAllTags } from '@/lib/content'
import { getAllAuthors } from '@/lib/authors'
import ArticleCard from './components/ArticleCard'
import Image from 'next/image'

export default async function HomePage() {
  const articles = getAllArticles()
  const tags = getAllTags().slice(0, 14)
  const featured = articles[0]
  const second = articles[1]
  const rest = articles.slice(2, 6)

  const allAuthors = getAllAuthors()
  const authorsWithCount = allAuthors
    .map(a => ({ ...a, count: a.articleCount }))
    .filter(a => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <>
      {/* Hero */}
      <section className="bg-cream px-4 py-8 sm:px-6 sm:py-12 md:py-16">
        <div className="mx-auto max-w-7xl border-y-2 border-charcoal py-1">
          <div className="border-y border-line px-4 py-10 text-center sm:py-14 md:py-20">
            <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight text-charcoal sm:text-6xl md:text-7xl lg:text-8xl">
              Taní-tani Online
            </h1>
            <p className="mx-auto mt-5 max-w-2xl font-body text-base italic text-charcoal sm:text-lg md:text-xl">
              A szabad pedagógiai gondolkodás fóruma
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/cikkek" className="btn-primary">
                Archívum →
              </Link>
              <Link href="/temakorok" className="btn-outline">
                Témakörök
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tags bar */}
      <section className="bg-sand border-b border-line overflow-x-auto">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 items-center">
          <span className="font-sans text-xs text-muted whitespace-nowrap mr-1">Témakörök:</span>
          {tags.map(tag => (
            <Link
              key={tag}
              href={tagHref(tag)}
              className="font-sans text-xs whitespace-nowrap text-brand px-2.5 py-1 rounded-full border border-brand-light bg-brand-light hover:bg-brand hover:text-white transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>

      <div className="editorial-home max-w-7xl mx-auto px-6 py-10 md:py-14">

        {/* Featured */}
        {featured && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-muted">Kiemelt cikk</h2>
              <div className="flex-1 h-px bg-line" />
            </div>
            <ArticleCard article={featured} featured />
          </section>
        )}

        {/* Tiered grid */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-muted">Legújabb cikkek</h2>
              <div className="w-10 h-px bg-line" />
            </div>
            <Link href="/cikkek" className="font-sans text-sm text-brand font-medium hover:underline">Mind →</Link>
          </div>

          {/* Top row: large + one standard */}
          {second && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              <ArticleCard article={second} large />
              {rest[0] && <ArticleCard article={rest[0]} />}
            </div>
          )}

          {/* Bottom row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.slice(1).map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>

        {/* Author spotlight */}
        {authorsWithCount.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-muted">Szerzőink</h2>
              <div className="flex-1 h-px bg-line" />
              <Link href="/szerzokrol" className="font-sans text-sm text-brand font-medium hover:underline">Mind →</Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {authorsWithCount.map(author => (
                <Link
                  key={author.slug}
                  href={`/szerzok/${author.slug}`}
                  className="block"
                >
                  <div className="card-lift bg-white border border-line p-4 flex flex-col items-center text-center gap-2.5">
                    {author.photo ? (
                      <Image
                        src={author.photo}
                        alt={author.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-full object-cover object-top border-2 border-line"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center font-display text-xl font-bold text-brand">
                        {author.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-sans text-sm font-semibold text-charcoal leading-snug">{author.name}</div>
                      <div className="font-sans text-xs text-muted">{author.count} cikk</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* About strip */}
        <section className="border-y-2 border-charcoal bg-white p-6 md:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-brand mb-3">A Taní-tani Online-ról</h2>
            <p className="font-body text-base leading-relaxed text-charcoal max-w-2xl">
              1996 óta vagyunk a progresszív pedagógiai gondolkodás fóruma Magyarországon. Több mint 600 szerző, több mint ezer cikk – ingyenesen, szabadon hozzáférhetően. Creative Commons licenc alatt.
            </p>
          </div>
          <Link href="/rolunk" className="btn-outline shrink-0">Rólunk</Link>
        </section>
      </div>
    </>
  )
}
