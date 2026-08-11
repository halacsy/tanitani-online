import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllArticles } from '@/lib/content'
import ArticleArchive, { ARTICLES_PER_PAGE } from '@/app/components/ArticleArchive'
import Link from 'next/link'

interface Props {
  params: Promise<{ page: string }>
}

export function generateStaticParams() {
  const totalPages = Math.ceil(getAllArticles().length / ARTICLES_PER_PAGE)
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
    page: String(index + 2),
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params
  return {
    title: `Cikkarchívum – ${page}. oldal`,
    description: `A Taní-tani Online teljes cikkarchívumának ${page}. oldala.`,
  }
}

export default async function ArticleArchivePage({ params }: Props) {
  const pageNumber = Number.parseInt((await params).page, 10)
  const allArticles = getAllArticles()
  const totalPages = Math.ceil(allArticles.length / ARTICLES_PER_PAGE)
  if (!Number.isInteger(pageNumber) || pageNumber < 2 || pageNumber > totalPages) notFound()

  const start = (pageNumber - 1) * ARTICLES_PER_PAGE
  const articles = allArticles.slice(start, start + ARTICLES_PER_PAGE)

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/cikkek" className="font-sans text-sm text-brand hover:underline">
          ← Cikkarchívum
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal mt-4 mb-2">
          Cikkarchívum
        </h1>
        <p className="font-sans text-sm text-muted">{pageNumber}. oldal / {totalPages}</p>
      </div>
      <ArticleArchive articles={articles} page={pageNumber} totalArticles={allArticles.length} />
    </div>
  )
}
