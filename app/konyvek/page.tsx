import type { Metadata } from 'next'
import Image from 'next/image'
import { getAllBooks, getBookIntroduction } from '@/lib/books'

export function generateMetadata(): Metadata {
  return { title: getBookIntroduction().title }
}

export default function BooksPage() {
  const books = getAllBooks()
  const introduction = getBookIntroduction()
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 md:py-14">
      <h1 className="font-display text-3xl md:text-5xl font-bold text-charcoal mb-7">{introduction.title}</h1>
      <div className="prose prose-lg max-w-none imported-html mb-12" dangerouslySetInnerHTML={{ __html: introduction.bodyHtml }} />
      <div className="space-y-7">
        {books.map(book => (
          <article key={book.slug} id={book.slug} className="scroll-mt-8 rounded-xl border border-line bg-white p-5 md:p-7 grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Image src={book.cover} alt="" width={160} height={230} className="w-40 h-auto self-start" />
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-semibold text-charcoal leading-snug">{book.title}</h2>
              <p className="font-sans text-charcoal mt-2">{book.creators}</p>
              <p className="font-sans text-sm text-muted mt-1">{book.publication}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {book.links.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} className="inline-block rounded border border-brand px-3 py-1.5 font-sans text-sm text-brand hover:bg-brand-light">{link.label}</a>)}
              </div>
              <details className="mt-6 group">
                <summary className="cursor-pointer font-sans text-brand underline">Leírás</summary>
                <div className="prose max-w-none imported-html mt-4" dangerouslySetInnerHTML={{ __html: book.descriptionHtml }} />
              </details>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
