import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface Author {
  slug: string
  name: string
  photo: string
  bio: string
}

const szerzokDir = path.join(process.cwd(), 'content', 'szerzok')

export function getAllAuthors(): Author[] {
  if (!fs.existsSync(szerzokDir)) return []
  const files = fs.readdirSync(szerzokDir).filter(f => f.endsWith('.md'))
  return files.map(filename => {
    const slug = filename.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(szerzokDir, filename), 'utf-8')
    const { data } = matter(raw)
    return {
      slug,
      name: data.name ?? '',
      photo: data.photo ?? '',
      bio: data.bio ?? '',
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'hu'))
}

export function getAuthorBySlug(slug: string): Author | null {
  const filePath = path.join(szerzokDir, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data } = matter(raw)
  return {
    slug,
    name: data.name ?? '',
    photo: data.photo ?? '',
    bio: data.bio ?? '',
  }
}
