import { notFound, redirect } from 'next/navigation'
import { getAllArchivePages, getArchivePageBySlug } from '@/lib/pages'

interface Props {
  params: Promise<{ legacy: string }>
}

export function generateStaticParams() {
  return getAllArchivePages()
    .filter(page => page.slug.startsWith('konyvek/'))
    .map(page => ({ legacy: page.slug.slice('konyvek/'.length) }))
}

export default async function LegacyBookRoute({ params }: Props) {
  const { legacy } = await params
  const page = getArchivePageBySlug(`konyvek/${legacy}`)
  if (page) redirect(`/archivum/${page.slug}`)
  notFound()
}
