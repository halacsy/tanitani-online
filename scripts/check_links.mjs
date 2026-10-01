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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LinkChecker } from 'linkinator'

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

  console.log(`Helyi szerver indítása a(z) ${port} porton...`)
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  let exitCode = 0
  try {
    await waitForServer(origin)

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

    const broken = result.links.filter(link => link.state === 'BROKEN')
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
