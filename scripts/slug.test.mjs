import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { CANONICAL_SLUG_PATTERN, comparableSlug, isCanonicalSlug, slugify } from '../lib/slug.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('a magyar ékezetek ASCII alakot kapnak', () => {
  assert.equal(slugify('Árvíztűrő tükörfúrógép'), 'arvizturo-tukorfurogep')
  assert.equal(slugify('Új cikket írunk'), 'uj-cikket-irunk')
  assert.equal(slugify('Őszi szünet a gödöllői iskolában'), 'oszi-szunet-a-godolloi-iskolaban')
})

test('csak kisbetűs ASCII betű, szám és kötőjel marad', () => {
  assert.equal(slugify('PISA 2022. évi eredményei'), 'pisa-2022-evi-eredmenyei')
  assert.equal(slugify('Mi az? (2. rész!)'), 'mi-az-2-resz')
  // A Decap ASCII kódolása meghagyná az `_` és `~` jelet, mi kötőjelre cseréljük.
  assert.equal(slugify('vita_a~tantervrol'), 'vita-a-tantervrol')
})

test('az aposztróf eltűnik, nem lesz belőle kötőjel', () => {
  assert.equal(slugify("Tanár' úr"), 'tanar-ur')
  assert.equal(slugify('O’Neill pedagógiája'), 'oneill-pedagogiaja')
})

test('az elválasztók összevonódnak és a széleken lemaradnak', () => {
  assert.equal(slugify('  ---Szia!!---  '), 'szia')
  assert.equal(slugify('!!!'), '')
  assert.equal(slugify(''), '')
  assert.equal(slugify(null), '')
})

test('a slugképzés idempotens', () => {
  for (const title of ['Árvíztűrő tükörfúrógép', 'Mi az? (2. rész!)', '  ---Szia!!---  ']) {
    assert.equal(slugify(slugify(title)), slugify(title))
  }
})

test('isCanonicalSlug pontosan a kanonikus alakot fogadja el', () => {
  for (const good of ['arvizturo-tukorfurogep', 'pisa2022', 'a-b-c', '074']) {
    assert.ok(isCanonicalSlug(good), `${good} kanonikus`)
  }
  for (const bad of ['Árvíztűrő', 'a_b', 'a--b', '-a', 'a-', 'a b', '', 'A-B', undefined]) {
    assert.ok(!isCanonicalSlug(bad), `${bad} nem kanonikus`)
  }
  assert.match('arvizturo-tukorfurogep', new RegExp(CANONICAL_SLUG_PATTERN))
})

test('comparableSlug elnyeli az ékezetet és az elválasztót', () => {
  assert.equal(comparableSlug('uj-cikket-írunk'), comparableSlug('uj_cikket_irunk'))
  assert.equal(comparableSlug('az_izraeli_oktatásrol'), 'azizraelioktatasrol')
})

test('minden meglévő cikkcímből kanonikus slug képezhető', () => {
  const dir = path.join(root, 'content', 'cikkek')
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.md'))
  assert.ok(files.length > 0, 'van cikk a content/cikkek mappában')

  for (const file of files) {
    const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'))
    if (!data.title) continue
    const slug = slugify(data.title)
    assert.ok(
      slug === '' || isCanonicalSlug(slug),
      `"${data.title}" → "${slug}" nem kanonikus`,
    )
  }
})

test('az admin előnézeti útvonala és a kanonikus URL ugyanazt a slugot használja', () => {
  const config = fs.readFileSync(path.join(root, 'public', 'admin', 'config.yml'), 'utf-8')
  assert.match(config, /^\s*encoding:\s*ascii$/m)
  assert.match(config, /^\s*clean_accents:\s*true$/m)
  assert.match(config, /^\s*sanitize_replacement:\s*"-"$/m)
  assert.match(config, /^\s*slug:\s*"\{\{slug\}\}"$/m)
  assert.match(config, /^\s*preview_path:\s*\/cikkek\/\{\{slug\}\}$/m)
  assert.match(config, /^\s*preview_path:\s*\/szerzok\/\{\{slug\}\}$/m)
})
