import { notFound, redirect } from 'next/navigation'
import { getArticleById } from '@/lib/content'
import { getArchivePageById } from '@/lib/pages'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DrupalNodeRoute({ params }: Props) {
  const id = Number.parseInt((await params).id, 10)
  if (!Number.isInteger(id)) notFound()

  const article = getArticleById(id)
  if (article) redirect(`/cikkek/${article.slug}`)

  const page = getArchivePageById(id)
  if (page) redirect(`/archivum/${page.slug}`)

  notFound()
}
