/**
 * Kanonikus webcím (slug) szabály – a #12 feladat egyetlen forrása.
 *
 * Ugyanazt adja, mint a Decap CMS a `public/admin/config.yml`
 * `slug: { encoding: ascii, clean_accents: true, sanitize_replacement: "-" }`
 * beállításával, egy szigorítással: a Decap ASCII kódolása meghagyná az `_`,
 * `~` és `.` karaktert, itt ezek is kötőjellé válnak. Így a szerkesztőben
 * generált fájlnév, az admin előnézeti útvonala és a publikus kanonikus URL
 * mindig ugyanaz a `[a-z0-9-]` alakú slug.
 */

/** Kanonikus slug: csupa kisbetűs ASCII, szám és egyszeres kötőjel. */
export const CANONICAL_SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'

const canonicalSlugRe = new RegExp(CANONICAL_SLUG_PATTERN)

// Az NFKD felbontás a magyar ékezeteket (á, é, í, ó, ö, ő, ú, ü, ű) kezeli.
// Az alábbi betűk nem bomlanak ékezetes alakra, ezért kézi megfeleltetést
// kapnak – a Decap `clean_accents` táblázatával egyezően.
const transliterations = new Map(Object.entries({
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ħ: 'h', ı: 'i',
}))

/**
 * Címből vagy tetszőleges szövegből kanonikus slugot képez.
 *
 * @param {unknown} value
 * @returns {string} kanonikus slug, vagy üres sztring, ha nem maradt karakter
 */
export function slugify(value) {
  const lowered = String(value ?? '')
    .trim()
    .toLocaleLowerCase('hu')
    // A Decap az aposztrófokat törli, nem kötőjelre cseréli: "Tanár' úr" → tanar-ur.
    .replace(/['’‘`´]/g, '')

  const transliterated = Array.from(lowered)
    .map(character => transliterations.get(character) ?? character)
    .join('')

  return transliterated
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Igaz, ha a slug megfelel a kanonikus alaknak.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalSlug(value) {
  return typeof value === 'string' && canonicalSlugRe.test(value)
}

/**
 * Összehasonlítási kulcs: az ékezetek és az elválasztók eltérését elnyeli.
 * Ezzel talál rá a publikus útvonal a régi, ékezetes vagy aláhúzásos URL-ekre.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function comparableSlug(value) {
  return slugify(value).replaceAll('-', '')
}
