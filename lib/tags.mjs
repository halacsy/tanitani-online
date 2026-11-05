import { slugify } from './slug.mjs'

export function tagHref(name) {
  return `/temakorok/${slugify(name)}`
}

export function findTagName(tags, value) {
  const canonical = tags.find(name => slugify(name) === value)
  if (canonical) return canonical
  if (tags.includes(value)) return value
  try {
    const decoded = decodeURIComponent(value)
    return tags.find(name => name === decoded) ?? null
  } catch {
    return null
  }
}
