# Szerzői portrék és ellenőrzés

A követelményeket a [#41 PRD](https://github.com/halacsy/tanitani-online/issues/41)
rögzíti. A hozzárendelés a migrált cikkek beágyazott képeinek `alt`
attribútumát veti össze a cikkhez kapcsolt szerző nevével. Az összehasonlítás
Unicode-normalizálást, kisbetűsítést és szóköz-normalizálást használ; részleges
névegyezésből, fájlnévből vagy arcfelismerésből nem készül hozzárendelés.

Egyetlen, helyben létező képjelölt automatikusan használható. Az ismétlődő
képútvonal egy jelöltnek számít. Több különböző kép, névütközés vagy hiányzó
képfájl esetén nincs automatikus választás. A forráscikk és az eredeti képcím
(ha van) visszakereshető az ellenőrzőoldalon.

## Ellenőrzőoldal készítése és átadása

```sh
npm run authors:photos
```

Az eredmény a `reports/author-photos.html`. Egyetlen, önálló fájl: a képeket
beágyazva tartalmazza, ezért önmagában átadható Imrének, és böngészőben,
bejelentkezés és helyi szerver nélkül megnyitható. A forráscikkek és profilok
linkjei a publikus production webhelyre vezetnek, ezekhez internet szükséges.
A generált jelentés nem része a production webhelynek és nincs verziókezelve.

Imre névre kereshet és állapot szerint szűrhet. A kép melletti választóval
jóváhagyhat egy automatikus találatot, választhat több kép közül, vagy a
„Maradjon monogram” lehetőséggel elvetheti a képeket. A böngésző megpróbálja
helyben megőrizni a döntéseket, de az átadáshoz a „Döntések letöltése” gombbal
kell menteni. A letöltött JSON később ugyanazon az ellenőrzőoldalon vissza is
tölthető. Újragenerált jelentéshez a korábbi JSON-t kell betölteni; az új
forrásból már nem igazolható választás hibát jelez.

Az állapotszűrő a jelentés készítésekor fennálló állapotot mutatja; a
választógombok az aktuális döntést jelzik. A letöltött fájl az explicit
döntéseket tartalmazza, a változatlan automatikus találatok a forrásból
újraszámíthatók.

## Döntések alkalmazása

```sh
npm run authors:photos -- --apply /teljes/utvonal/szerzoi-portrek-dontesek.json
```

A parancs előbb minden döntést ellenőriz: ismert szerző, hozzá tartozó jelölt,
biztonságos publikus képútvonal és létező fájl szükséges. Egyetlen érvénytelen
döntés esetén sem módosítja a döntéstárat. A hiányzó döntések nem törlik a
korábbiakat. A `null` kifejezetten monogramot kér, ezért felülírja az
automatikus találatot is.

Az érvényes döntések a `content/author-photo-decisions.json` fájlba kerülnek.
Ezután automatikusan lefut a Markdown-materializálás és újragenerálódik a
jelentés. A változások a szokásos ellenőrzés és kiadás után jelennek meg a
webhelyen; Imre böngészős választása önmagában nem publikál.

A `migrate:markdown` ugyanabból a forrásból és döntéstárból tölti ki a szerzői
`photo` mezőt, ezért migrációkor a döntések megmaradnak. A már létező,
kézzel beállított Móka János- és L. Ritók Nóra-portré bekerült a döntéstárba;
a nem migrált szerzői Markdown-fájlokat a migrációs generátor továbbra sem
írja át. Ezeknél a döntések alkalmazása kizárólag a `photo` mezőt frissíti.
Az archív JSON és az eredeti médiafájlok változatlanok maradnak.

A kiadás előtt az AGENTS.md teljes ellenőrzési sora szükséges:

```sh
npm run migrate:validate
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run check:links
```
