#!/usr/bin/env node

/**
 * Ellenőrzi, hogy a szerkesztőben készült tartalom webcíme kanonikus-e (#12).
 *
 * A migrált archívum fájlnevei (`migratedId` a fejlécben) érintetlenek
 * maradnak: a régi URL-eket nem nevezzük át. Minden más cikk és minden szerző
 * slugja csak kisbetűs ASCII betűt, számot és egyszeres kötőjelet tartalmazhat.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { CANONICAL_SLUG_PATTERN, isCanonicalSlug, slugify, comparableSlug } from '../lib/slug.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const collections = [
  { label: 'cikkek', dir: path.join(root, 'content', 'cikkek'), allowMigrated: true },
  { label: 'szerzők', dir: path.join(root, 'content', 'szerzok'), allowMigrated: false },
]

const errors = []
const stats = { checked: 0, archived: 0 }

for (const collection of collections) {
  if (!fs.existsSync(collection.dir)) continue

  const comparableOwners = new Map()

  for (const fileName of fs.readdirSync(collection.dir).sort()) {
    if (!fileName.endsWith('.md')) continue

    const slug = fileName.slice(0, -3)
    const filePath = path.join(collection.dir, fileName)
    const { data } = matter(fs.readFileSync(filePath, 'utf-8'))
    const isArchived = collection.allowMigrated && data.migratedId !== undefined

    // Két bejegyzés webcíme nem különbözhet csak ékezetben vagy elválasztóban:
    // a régi URL-ek feloldása ilyenkor kétértelmű lenne.
    const key = comparableSlug(slug)
    const owner = comparableOwners.get(key)
    if (owner) {
      errors.push(`${collection.label}: "${slug}" és "${owner}" webcíme csak ékezetben vagy elválasztóban tér el`)
    } else {
      comparableOwners.set(key, slug)
    }

    if (isArchived) {
      stats.archived++
      continue
    }

    stats.checked++
    if (isCanonicalSlug(slug)) continue

    errors.push(
      `${collection.label}: "${fileName}" webcíme nem kanonikus – javasolt fájlnév: "${slugify(slug) || 'cikk'}.md"`,
    )
  }
}

if (errors.length > 0) {
  console.error('Nem kanonikus webcímek (elvárt alak: ' + CANONICAL_SLUG_PATTERN + '):\n')
  for (const error of errors) console.error('  - ' + error)
  console.error(
    '\nA Decap CMS az új bejegyzéseket már ékezetmentes ASCII sluggal menti. ' +
    'Meglévő fájlt átnevezés után a régi webcím a kanonikusra irányít.',
  )
  process.exit(1)
}

console.log(
  `Webcím-ellenőrzés rendben: ${stats.checked} szerkesztői slug kanonikus, ` +
  `${stats.archived} archív slug érintetlen.`,
)
