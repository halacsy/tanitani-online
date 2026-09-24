import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const navigation = JSON.parse(fs.readFileSync('public/navigation.json', 'utf8'))
const pages = JSON.parse(fs.readFileSync('content/migrated/tanitani/pages.json', 'utf8'))
const issueSlugs = ['074_tartalom', '081_tartalom', '082_tartalom', 'node-19', '084tartalom', 'node-69', '092tartalom', '093tartalom', '094_tartalom', '101_tartalom', '102_tartalom', '54_szam']
let checked = 0
async function check(path) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`)
  checked++
  return response.text()
}
for (const item of [...navigation.main, ...navigation.footer, navigation.search]) await check(item.href)
const home = await check('/')
assert(!home.includes('Partnereink'))
assert(home.includes('Hírlevél-feliratkozás'))
const periodical = await check('/folyoirat')
for (const slug of issueSlugs) {
  assert(periodical.includes(`href="/archivum/${slug}"`), `Missing issue: ${slug}`)
  const body = await check(`/archivum/${slug}`)
  assert(body.includes('Nyomtatott folyóirat'), `Missing sibling navigation: ${slug}`)
  const page = pages.find(page => page.slug === slug)
  await check(`/node/${page.id}`)
  if (!slug.startsWith('node-')) await check(`/${slug}`)
}
assert(periodical.includes('1-S6DqtoHshKZDiVr7BNLleVg1YZbqj5G'))
const about = await check('/rolunk')
assert(about.includes('id="tortenet"'))
assert(!about.includes('Partnereink'))
for (const [slug, destination] of Object.entries({mi_ez: '/folyoirat', rovatok: '/folyoirat/rovatok', fomunkatarsaink: '/fomunkatarsaink', hirlevel: navigation.newsletter.href})) {
  const page = pages.find(page => page.slug === slug)
  for (const path of [`/${slug}`, `/node/${page.id}`, `/archivum/${slug}`]) {
    if (path === destination) { await check(path); continue }
    const response = await fetch(`${base}${path}`, { redirect: 'manual' })
    assert([307, 308].includes(response.status), `${path}: missing redirect`)
    assert.equal(new URL(response.headers.get('location'), base).href, new URL(destination, base).href)
    checked++
  }
}
console.log(`Navigáció: ${checked} sikeres HTTP- és átirányítás-ellenőrzés; 12 lapszám, különszám, történet és menüpontok rendben.`)
