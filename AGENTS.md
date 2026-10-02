# Taní-tani Online – agent útmutató

> **TILOS OLVASHATÓ TARTALMAT AI AGENSNEK FABRIKÁLNIA: CSAK KÓDOT SZABAD ÍRNI.**
> Szerzői életrajz, cikkszöveg, idézet vagy bármilyen más, embereknek szóló
> tartalom soha nem származhat az AI saját kitalálásából. Minden ilyen
> tartalomnak valódi forrásból kell jönnie (a migrált DB-export, a
> `tanitani.sql`/`tanitani_tanmest.sql` dump, vagy a szerkesztő saját, általa
> megadott szövege). Ha egy mezőhöz (pl. `bio`) nincs hiteles forrásszöveg,
> azt üresen kell hagyni – nem szabad plauzibilisnek tűnő helyettesítő
> szöveget generálni. Ez a szabály pontosan azért került be, mert korábban
> egy agent kitalált, hiteles adatnak látszó szerzői életrajzokat írt be
> több `content/szerzok/*.md` fájlba (lásd a #6 issue-t és annak javítását).

## A projekt célja

Ez a repository a régi Drupal 7 alapú `tani-tani.info` teljes publikus
archívumának Next.js 16 alapú új platformja. A történeti SQL dump az archiválási
forrás, a webhely azonban kizárólag adatminimalizált, publikus exportot használ.

## Technológia és kiadás

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- A production buildet a `netlify.toml` szerinti Netlify Next.js plugin készíti.
- A production domain alapértelmezetten `https://www.tani-tani.info`; más hostnál
  állítsd be a `NEXT_PUBLIC_SITE_URL` környezeti változót.
- Google Analytics (#5): a `NEXT_PUBLIC_GA_MEASUREMENT_ID` környezeti változó
  állítja be a GA4 mérési azonosítót. Csak akkor töltődik be, ha ez be van
  állítva, és csak a valódi production kiadáson (nem deploy preview vagy helyi
  fejlesztés). A mérés Consent Mode-dal alapértelmezetten le van tiltva; a
  látogató a lábjegyzet feletti sávban adhat vagy tagadhat hozzájárulást
  (`app/components/Analytics.tsx`).
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
- A fájlokat ne szerkeszd kézzel. A teljes pipeline egyben: `npm run migrate`.
  Lépésenként:

  1. **húzz friss dumpot** a régi Drupal adatbázisról, és állítsd vissza
     MariaDB 10.11-be (kézi előfeltétel, nincs scriptelve);
  2. `npm run migrate:export`;
  3. `npm run migrate:media`;
  4. `npm run migrate:sync`;
  5. `npm run migrate:markdown`;
  6. `npm run migrate:validate`.

- **Az adatbázis-export (`migrate:export`) az elsődleges forrás, nem a
  weboldal.** A `migrate:sync` csak a dump és a tényleges migrálás közti
  (ideális esetben pár órás/napos) rést tölti ki: a régi oldalt közvetlenül
  kérdezi le HTTP-n, mert a dump a lehúzás pillanatában lefagyasztott
  állapot, és nem tartalmazhatja az azóta megjelent cikkeket. Minél
  frissebb a dump az 1. lépésben, annál kevesebb cikket kell a
  `migrate:sync`-nek a weboldalról pótolnia – ezért **mindig húzz friss
  dumpot közvetlenül a migrálás előtt**, ne hónapokkal korábbit. A
  `migrate:sync` valódi HTML-parsert (lxml) és ugyanazt a
  `sanitize_public_html` tisztítást használja, mint az adatbázis-export,
  de attól még a renderelt weboldalból dolgozik, nem SQL-mezőkből – a
  dumpból jövő adat a megbízhatóbb.
- Az exportáló szkript atomikusan cseréli a generált JSON-könyvtárat.
- A `migrate:sync` a dump utáni publikus Drupal-cikkeket és a fájltáblában nem
  szereplő inline médiát is beemeli. A publikus oldalon nem látható új címkéket
  a meglévő címkekészletből, tartalmi előfordulás alapján rendeli hozzá; ezt a
  migrációs metaadatokban mindig jelölni kell.
- A `migrate:markdown` determinisztikusan, kizárólag a migrált JSON-forrásból
  állítja elő a `content/cikkek/*.md` / `content/szerzok/*.md` fájlokat: ha egy
  fájl már egyezik azzal, amit a forrásból generálna, nem nyúl hozzá; ha eltér
  (hiányzik, vagy a forrás időközben változott), létrehozza/felülírja. Mivel a
  migráció aktív szakaszában a Next oldalon senki nem szerkeszt kézzel
  (a szerkesztői munka csak a végleges átállás után, a Decap CMS-en keresztül
  kezdődik), ez biztonságosan, akárhányszor újrafuttatható. Lásd még a
  legfelül lévő, kiemelt szabályt: ha egy mezőhöz nincs hiteles forrás, üresen
  marad, sosem fabrikálunk helyette szöveget.
- A részletes rekonstrukciós jegyzőkönyv:
  `docs/database-reconstruction.md`.

## Szerkesztői tartalom

- A `content/migrated/tanitani/` alatti történeti JSON-export továbbra is
  read-only archívumként kezelendő.
- Minden migrált cikk szerkeszthető Markdown-példánya a
  `content/cikkek/*.md`, minden migrált szerzőé a `content/szerzok/*.md`
  mappában van. Az új cikkek és szerzők is ezekbe a mappákba kerülnek.
- A `migrate:markdown` a migrált JSON-forrásból determinisztikusan létrehozza
  vagy frissíti a Markdown-fájlokat (lásd fent). A `migratedId` köti a
  Markdown-cikket az archív rekordhoz, így a hozzászólások, csatolmányok és
  régi URL-ek megmaradnak. A fájlnév mindig a migrált rekord valódi slugja –
  ha egy fájl ettől eltérő néven jött létre (pl. korábbi, hibás eszközből),
  nevezd át a slugra, különben a kanonikus URL nem fogja megtalálni.
- A `lib/content.ts` migrált cikk esetén a Markdown szerkesztői mezőit használja,
  a nem szerkesztett történeti metaadatokat pedig az archív JSON-ból egészíti ki.
- Új cikkhez legalább cím, dátum, szerző, összefoglaló és törzsszöveg tartozzon.
  A borítókép ajánlott mérete 1200×630 px.
- Az új bejegyzések webcíme ékezetmentes ASCII slug, csak `[a-z0-9-]`
  karakterekkel. A szabály egyetlen forrása a `lib/slug.mjs`; a Decap oldalán a
  `public/admin/config.yml` `slug:` blokkja állítja elő ugyanezt. A migrált
  archívum aláhúzásos és ékezetes fájlneveit nem nevezzük át.
- Az adminban be van kapcsolva a szerkesztői folyamat
  (`publish_mode: editorial_workflow`): a mentés a `cms/<gyűjtemény>/<slug>`
  ágra és egy pull requestre megy, a production csak publikáláskor változik.
  A folyamat leírása: `docs/szerkesztoi-folyamat.md`.

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
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run check:links
```

A `check:links` (#4) a teljes épített oldalt bejárja (production build + helyi
szerver) és minden belső hivatkozást leellenőriz – a migrált archívumot, a
szerkesztői cikkeket/oldalakat és a médiát is. Külső (más domainre mutató)
linkeket szándékosan kihagy. Hibás hivatkozás esetén nem nulla kilépési
kóddal áll le, listázva a hibás URL-t és a hivatkozó oldalt.

A production build jelenlegi referenciaeredménye (az `npm run migrate`
legutóbbi, 2026 október eleji teljes lefuttatása után):

- 1 240 cikk;
- 626 szerzői rekord;
- 236 címke, közülük 162 használatban;
- 77 archív oldal;
- 1 039 publikus hozzászólás;
- 1 327 csatolmány;
- 2 177 generált Next.js oldal.

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
- A `/cikkek/<slug>` útvonal az ékezet- és elválasztófüggetlen alak alapján is
  megtalálja a cikket, és állandó átirányítással a kanonikus slugra küld.

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
