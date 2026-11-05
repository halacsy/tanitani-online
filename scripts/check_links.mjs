#!/usr/bin/env node
// Belső hivatkozások ellenőrzése (#4).
//
// Bejárja a teljes épített oldalt (migrált archívum, szerkesztői cikkek,
// oldalak, média), és minden belső (site-on belüli) hivatkozást leellenőriz.
// A production buildet és egy helyi szervert használ, hogy pontosan azt
// ellenőrizze, ami ki fog kerülni. Kiadás előtti validáció részeként
// megismételhető: `npm run check:links`.
//
// A `scripts/known-broken-links.json` a migrált archívumból örökölt, ismert
// hibás hivatkozásokat sorolja fel (dokumentált kivétel); ezeket a script nem
// nulla kilépési kóddal jelzi, csak az itt nem szereplő, ÚJ hibás belső
// hivatkozás buktatja el a futást.
//
// Használat:
//   npm run check:links                 # épít, elindít, ellenőriz, leáll
//   npm run check:links -- --no-build   # csak a már meglévő .next buildet indítja
//   npm run check:links -- --port 4173

import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LinkChecker } from 'linkinator'
import { Parser } from 'htmlparser2'
import { isCanonicalSlug } from '../lib/slug.mjs'
import { tagHref } from '../lib/tags.mjs'

const args = process.argv.slice(2)
const skipBuild = args.includes('--no-build')
const portIndex = args.indexOf('--port')
const port = portIndex !== -1 ? Number(args[portIndex + 1]) : 4173
const origin = `http://localhost:${port}`

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const knownBrokenPath = path.join(scriptDir, 'known-broken-links.json')
const knownBroken = new Set(JSON.parse(readFileSync(knownBrokenPath, 'utf-8')).hivatkozasok)

function normalize(url) {
  return url.startsWith(origin) ? url.slice(origin.length) : url
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: 'inherit', ...options })
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${commandArgs.join(' ')} kilépési kód: ${code}`))
    })
    child.on('error', reject)
  })
}

async function waitForServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status === 404) return
    } catch {
      // A szerver még nem fogad kapcsolatot; próbáljuk újra.
    }
    await delay(500)
  }
  throw new Error(`A helyi szerver nem indult el ${attempts * 500}ms alatt (${url})`)
}

async function main() {
  if (!skipBuild) {
    console.log('Production build készítése...')
    await run('npx', ['next', 'build'])
  }

  // Check the build artifacts before runtime rendering can mask an encoding bug.
  const topicsDir = path.join(scriptDir, '..', '.next', 'server', 'app', 'temakorok')
  const topics = readdirSync(topicsDir).filter(file => file.endsWith('.html'))
  const topicNames = []
  assert(topics.length > 0, 'No statically generated topic pages')
  for (const file of topics) {
    const slug = file.slice(0, -5)
    assert(isCanonicalSlug(slug), `Non-ASCII topic URL: ${file}`)
    let inHeading = false
    let heading = ''
    let canonical = ''
    const parser = new Parser({
      onopentag(name, attributes) {
        if (name === 'h1') inHeading = true
        if (name === 'link' && attributes.rel === 'canonical') canonical = attributes.href
      },
      ontext(text) { if (inHeading) heading += text },
      onclosetag(name) { if (name === 'h1') inHeading = false },
    })
    parser.end(readFileSync(path.join(topicsDir, file), 'utf-8'))
    assert.equal(tagHref(heading), `/temakorok/${slug}`, `Topic heading encoding: ${file}`)
    assert.equal(new URL(canonical).pathname, tagHref(heading), `Topic canonical URL: ${file}`)
    topicNames.push(heading)
  }
  console.log(`Témakörök: ${topics.length} statikus oldalcím ellenőrizve.`)

  console.log(`Helyi szerver indítása a(z) ${port} porton...`)
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  let exitCode = 0
  try {
    await waitForServer(origin)

    for (const name of topicNames) {
      const canonical = tagHref(name)
      const page = await fetch(`${origin}${canonical}`, { redirect: 'manual' })
      assert.equal(page.status, 200, `Canonical topic URL: ${canonical}`)
      const encoded = encodeURIComponent(name)
      for (const value of new Set([encoded, encodeURIComponent(encoded)])) {
        const legacy = `/temakorok/${value}`
        if (legacy === canonical) continue
        const response = await fetch(`${origin}${legacy}`, { redirect: 'manual' })
        assert.equal(response.status, 308, `Legacy topic redirect: ${legacy}`)
        assert.equal(new URL(response.headers.get('location'), origin).pathname, canonical)
      }
    }
    console.log('A régi témakör-URL-ek állandó átirányítása rendben.')

    console.log(`Belső hivatkozások bejárása innen: ${origin} ...`)
    const checker = new LinkChecker()
    let checked = 0
    checker.on('link', result => {
      checked += 1
      if (result.state === 'BROKEN') {
        console.log(`  [${result.status ?? '?'}] ${result.url}  (← ${result.parent ?? 'ismeretlen'})`)
      }
    })

    const result = await checker.check({
      path: origin,
      recurse: true,
      concurrency: 12,
      // Csak a site-on belüli hivatkozásokat ellenőrizzük; a külső linkeket
      // (más domain) kihagyjuk, mert ez az issue a belső URL-ekről szól.
      linksToSkip: [`^(?!${origin}).*$`],
    })

    // A nagy archívum bejárásakor a szerver időnként megszakít egy párhuzamos
    // kérést; a Linkinator ezt 0 státusszal jelzi. Az ilyen belső URL-t külön
    // újra lekérjük, hogy egy átmeneti hálózati hiba ne legyen hibás link.
    const broken = []
    for (const link of result.links.filter(link => link.state === 'BROKEN')) {
      if (link.status === 0 && link.url.startsWith(origin)) {
        let recovered = false
        for (let attempt = 0; attempt < 3 && !recovered; attempt++) {
          try {
            const response = await fetch(link.url, { signal: AbortSignal.timeout(15000) })
            recovered = response.ok
          } catch {
            // A következő próbálkozás még kezelheti az átmeneti hibát.
          }
        }
        if (recovered) continue
      }
      broken.push(link)
    }
    const newBroken = broken.filter(link => !knownBroken.has(normalize(link.url)))
    const known = broken.filter(link => knownBroken.has(normalize(link.url)))

    console.log('')
    console.log(`Bejárt oldalak: ${checked}, ellenőrzött hivatkozások: ${result.links.length}`)
    console.log(`Ismert (dokumentált) hibás hivatkozás: ${known.length} (lásd scripts/known-broken-links.json)`)

    if (newBroken.length === 0) {
      console.log('Nincs új hibás belső hivatkozás.')
    } else {
      console.log(`${newBroken.length} ÚJ hibás belső hivatkozás:`)
      for (const link of newBroken) {
        console.log(`  [${link.status ?? '?'}] ${link.url}  (← ${link.parent ?? 'ismeretlen'})`)
      }
      exitCode = 1
    }
  } finally {
    server.kill('SIGTERM')
    await delay(500)
  }

  process.exit(exitCode)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
