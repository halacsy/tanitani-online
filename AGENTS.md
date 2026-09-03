# Taní-tani Online – agent útmutató

## A projekt célja

Ez a repository a régi Drupal 7 alapú `tani-tani.info` teljes publikus
archívumának Next.js 16 alapú új platformja. A történeti SQL dump az archiválási
forrás, a webhely azonban kizárólag adatminimalizált, publikus exportot használ.

## Technológia és kiadás

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- A production buildet a `netlify.toml` szerinti Netlify Next.js plugin készíti.
- A production domain alapértelmezetten `https://www.tani-tani.info`; más hostnál
  állítsd be a `NEXT_PUBLIC_SITE_URL` környezeti változót.
- A `main` ágra kerülő változás csak az alábbi teljes ellenőrzési sor után
  tekinthető kiadhatónak.

## Adatforrások és adatvédelem

- `tanitani.sql`: a fő Drupal-adatbázis teljes dumpja.
- `tanitani_tanmest.sql`: a Tanmester aloldal dumpja.
- A dumpok felhasználókat, e-mail-címeket, jelszóhash-eket, munkameneteket,
  IP-címeket és naplókat is tartalmaznak. Soha ne commitold, publikáld vagy
  csomagold őket a webhelyhez.
- A `.gitignore` szándékosan kizár minden `*.sql`, `data/*.sqlite`, `.env*` és
  helyi letöltési napló állományt.
- A publikus SQLite sémát a `db/public-schema.sql` írja le. Az export csak
  cikkeket, szerzőket, címkéket, rovatokat, publikus oldalakat, csatolmányokat és
  a hozzászólások nyilvánosan látható nevét/tartalmát tartalmazhatja.
- Importált HTML-nél kötelező eltávolítani a script/object/embed elemeket,
  eseménykezelő attribútumokat, `javascript:` URL-eket és veszélyes CSS-t.

## Generált történeti tartalom

- `content/migrated/tanitani/` a build által használt, generált publikus archívum.
- A fájlokat ne szerkeszd kézzel. A helyes újraépítési sorrend:

  1. állítsd vissza a dumpot MariaDB 10.11-be;
  2. `npm run migrate:export`;
  3. `npm run migrate:media`;
  4. `npm run migrate:sync`;
  5. `npm run migrate:markdown`;
  6. `npm run migrate:validate`.

- Az exportáló szkript atomikusan cseréli a generált JSON-könyvtárat.
- A `migrate:sync` a dump utáni publikus Drupal-cikkeket és a fájltáblában nem
  szereplő inline médiát is beemeli. A publikus oldalon nem látható új címkéket
  a meglévő címkekészletből, tartalmi előfordulás alapján rendeli hozzá; ezt a
  migrációs metaadatokban mindig jelölni kell.
- A részletes rekonstrukciós jegyzőkönyv:
  `docs/database-reconstruction.md`.

## Szerkesztői tartalom

- A `content/migrated/tanitani/` alatti történeti JSON-export továbbra is
  read-only archívumként kezelendő.
- Minden migrált cikk szerkeszthető Markdown-példánya a
  `content/cikkek/*.md`, minden migrált szerzőé a `content/szerzok/*.md`
  mappában van. Az új cikkek és szerzők is ezekbe a mappákba kerülnek.
- A `migrate:markdown` csak hiányzó fájlokat hoz létre, meglévő szerkesztői
  tartalmat nem ír felül. A `migratedId` köti a Markdown-cikket az archív
  rekordhoz, így a hozzászólások, csatolmányok és régi URL-ek megmaradnak.
- A `lib/content.ts` migrált cikk esetén a Markdown szerkesztői mezőit használja,
  a nem szerkesztett történeti metaadatokat pedig az archív JSON-ból egészíti ki.
- Új cikkhez legalább cím, dátum, szerző, összefoglaló és törzsszöveg tartozzon.
  A borítókép ajánlott mérete 1200×630 px.

## Média

- A régi állományok az eredeti URL-ek megtartása miatt a
  `public/sites/default/files/` könyvtárban vannak.
- Ne nevezd át és ne tömörítsd tömegesen ezeket az állományokat: több ezer régi
  HTML-hivatkozás és külső link függ a pontos útvonaltól.
- A jelenlegi ellenőrzött állapot 4 709 médiakatalógus-rekordból 4 700 helyi
  fájl. Kilenc régi rekord az eredeti szerveren is 404, és a végleges tartalom
  már egyikre sem hivatkozik.
- Média módosítása után mindig futtasd a migrációs validátort; hiányzó tényleges
  hivatkozás esetén annak hibával kell leállnia.

## Kötelező ellenőrzések

Minden tartalmi, migrációs vagy kiadási változás után futtasd:

```bash
npm run migrate:validate
npx tsc --noEmit
npm run lint
npm run build
```

A production build jelenlegi referenciaeredménye:

- 1 216 cikk;
- 617 szerzői rekord;
- 236 címke, közülük 157 használatban;
- 77 archív oldal;
- 1 039 publikus hozzászólás;
- 1 324 csatolmány;
- 2 134 generált Next.js oldal.

Eltérő darabszám csak dokumentált új import vagy új szerkesztői tartalom miatt
fogadható el. Build előtt érdemes újra lefuttatni a publikus élő szinkront, ha az
eredeti oldal még fogad új cikkeket.

## URL-kompatibilitás és SEO

- A kanonikus új cikkútvonal: `/cikkek/<slug>`.
- A régi gyökérszintű aliasok, `/node/<id>` URL-ek és a beágyazott
  `/konyvek/...` oldalak átirányítását meg kell őrizni.
- Az RSS: `/rss.xml`; a régi `/posztfeed/rss.xml` erre irányít.
- A sitemap és robots fájl Next.js metadata route-ként készül.
- Új route vagy slug-logika esetén ellenőrizd a régi és új URL-t is.

## Munkamódszer

- Tartsd meg a magyar tipográfiát és ékezeteket; a kód és fájlnevek legyenek
  egyszerűek és következetesek.
- Ne módosíts vagy törölj felhasználói változást, SQL dumpot vagy médiát
  explicit indok nélkül.
- Nagy, generált állományhoz ne készíts kézi javítást; javítsd a generátort, majd
  generáld újra és validáld az eredményt.
- Titkot, tokent vagy `.env.local` tartalmat ne írj ki logba és ne commitolj.
- Git push előtt ellenőrizd a `git status` és `git diff --check` kimenetét, a
  tiltott fájlokat, valamint azt, hogy nincs 100 MB-nál nagyobb egyedi fájl.
