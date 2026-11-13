import { slugify } from './slug.mjs'

export function tagHref(name) {
  return `/temakorok/${slugify(name)}`
}

export function uniqueTagNames(tags) {
  const names = new Map()
  for (const name of tags) {
    const slug = slugify(name)
    if (!names.has(slug)) names.set(slug, name)
  }
  return [...names.values()]
}

export function findTagName(tags, value) {
  const canonical = tags.find(name => slugify(name) === value)
  if (canonical) return canonical
  if (tags.includes(value)) return value
  try {
    const decoded = decodeURIComponent(value)
    return tags.find(name => slugify(name) === slugify(decoded)) ?? null
  } catch {
    return null
  }
}
