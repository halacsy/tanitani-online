import { notFound, redirect } from 'next/navigation'
import { getArticleBySlug } from '@/lib/content'
import { getCurrentPageHref, getArchivePageBySlug } from '@/lib/pages'

interface Props {
  params: Promise<{ legacy: string }>
}

export default async function LegacyRoute({ params }: Props) {
  const { legacy } = await params
  const article = getArticleBySlug(legacy)
  if (article) redirect(`/cikkek/${article.slug}`)

  const page = getArchivePageBySlug(legacy)
  if (page) redirect(getCurrentPageHref(page.slug) ?? `/archivum/${page.slug}`)

  notFound()
}
