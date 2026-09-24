# Navigáció – 2026. szeptember 24.

A #8 feladat megvalósítása Imre szeptember 23-i menülistája és az elfogadott
UX-javaslat alapján. A menü közös forrása a `public/navigation.json`; ezt használja
a publikus fejléc, a lábléc és a Decap szerkesztői előnézet.

- Főmenü: Cikkek, Témakörök, Szerzők, Könyvek, Szerzői útmutató.
- Elkülönített Hírlevél-feliratkozás és Keresés. A hírlevél a régi honlap
  `eepurl.com/brJBUT` hivatkozásából ellenőrzött Mailchimp-űrlapra vezet.
- Alsó menü: Rólunk, Főmunkatársaink, Kapcsolat, Impresszum, Régi lapszámok,
  Jogi nyilatkozat, Adatkezelés.
- Mobilon és keskeny képernyőn a Keresés látható marad, a Menü gomb nyitja a
  teljes, csoportosított navigációt. Escape bezárja, a fókusz visszatér a gombra.
- A Szerzőinknek neve Szerzői útmutató, a Taní-tani Könyvek röviden Könyvek.
  A Főmunkatársaink a láblécbe került; nem neveztük át Szerkesztőségre, mert
  a két névsor eltérő. A tagság az eredeti oldal hat szerzőjét követi.
- A Partnereink blokk kikerült a láblécből, a Rólunkból és az előnézetből.

A `/folyoirat` megőrzi a régi `/mi_ez` bal oldali menü teljes választékát:
12 lapszám (2007/4–2010/3), Rovatok és a Google Drive-on elérhető 2009-es
különszám. A lapszámoldalakon asztali oldalsáv, mobilon tartalom alatti
lapszámválasztó és felül visszalink segíti a böngészést. A rovatok cikkei a
migrált rovat-hozzárendelésekből készülnek. A történeti szöveg a
`/rolunk#tortenet` alatt, az eredeti archív rekordból jelenik meg.

A régi aliasok, node-URL-ek és archív belépési pontok működnek; a `mi_ez`,
`rovatok`, `fomunkatarsaink` és `hirlevel` célzottan az aktuális megfelelőjükre
irányítanak. Az archív JSON és a médiák változatlanok. A sitemap az új oldalakat
felsorolja, az átirányító archív bejegyzéseket nem.

Három új oldal készült: `/folyoirat`, `/folyoirat/rovatok`, `/fomunkatarsaink`.
A cikk-, szerző- és migrált tartalomszámok változatlanok. A build jelenlegi
összesítője 2139 generált útvonalat számol (a korábbi dokumentált 2134-es
referencia óta szerkesztői tartalom is bekerült; ebben a változásban három új
oldal van).

Ellenőrzés: a kötelező migrációs validáció, TypeScript, lint és production build
mellett `node scripts/validate_navigation.mjs [alap-URL]` ellenőrzi a menücélokat,
lapszámokat és a kapcsolódó régi URL-ek átirányításait. A külső feliratkozási
űrlapot böngészőben, adatküldés nélkül ellenőrizzük.
