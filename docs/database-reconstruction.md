# Taní-tani adatbázis-rekonstrukció

## Források

- `tanitani.sql`: a fő Taní-tani Online Drupal-adatbázis teljes MariaDB dumpja.
- `tanitani_tanmest.sql`: a külön Tanmester aloldal Drupal-adatbázisa.
- Mindkét dump MariaDB 10.11 alatt készült 2026. május 5-én.

A dumpokat változtatás nélkül, elkülönített MariaDB 10.11 környezetben állítottuk
vissza. A fő adatbázis 161, a Tanmester adatbázis 115 táblát tartalmaz.

## Ellenőrzött fő tartalom

Az alábbi értékek közvetlenül a 2026. május 5-i SQL dump állapotát mutatják:

| Tartalom | Darabszám |
| --- | ---: |
| Publikált cikk (`poszt` + `cikk`) | 1 191 |
| Szerző | 608 |
| Témacímke | 236 |
| Publikált hozzászólás | 1 048 |
| Cikkhez tartozó hozzászólás | 1 039 |
| Kezelt fájlrekord | 4 076 |
| Publikált egyéb oldal/tartalom | 80 |
| Tanmester-cikk | 36 |

Az összes publikált cikkhez tartozik törzsszöveg, szerző, legalább egy címke és
régi URL-alias. A cikkek közül 104 több szerzővel jelent meg.

## Végleges migrált állapot

Az adatbázis-exportot a nyilvános Drupal-archívumból végzett, 2026. augusztus
11-i kiegészítő szinkron követi. A kiadásra kész migráció ellenőrzött értékei:

| Tartalom | Darabszám |
| --- | ---: |
| Publikált cikk | 1 216 |
| Szerző | 617 |
| Témacímke | 236 |
| Rovat | 13 |
| Cikkhez tartozó hozzászólás | 1 039 |
| Publikált archív oldal | 77 |
| Csatolmány | 1 324 |
| Összes médiakatalógus-rekord | 4 709 |
| Helyben archivált médiafájl | 4 700 |

## Publikus migrációs adatmodell

Az eredeti adatbázis teljes egészében archiválható, de nem szabad közvetlenül a
webhelyhez csomagolni. Felhasználói fiókokat, e-mail-címeket, jelszóhash-eket,
munkameneteket, IP-címeket, hozzáférési naplókat, gyorsítótárakat és rendszerlogokat
tartalmaz.

A `scripts/export_site_data.py` ezért egy külön, adatminimalizált SQLite-adatbázist
és a Next.js buildhez optimalizált JSON-fájlokat készít. Ezek csak a publikus
tartalmakat és a nyilvánosan megjelenő hozzászólói neveket tartalmazzák.

Az exportált kapcsolatok:

- cikkek, szerzők, címkék és rovatok;
- több-szerzős és több-címkés kapcsolatok;
- borítóképek és letölthető mellékletek metaadatai;
- hozzászólásfák, e-mail- és IP-adat nélkül;
- statikus oldalak és egyéb publikált tartalmak;
- régi Drupal URL-ek átirányítási térképe.

## A dump utáni kiegészítés

A dump 2026. május 5-én zárult; az élő oldal azóta új cikkekkel bővült. A dump
legfrissebb cikke a 2026. május 3-án megjelent „Több mint konfliktuskezelés”.
A `scripts/supplement_live_articles.py` a 1412–1436 közötti 25 új cikket,
9 új szerzőt és 44 új médiabejegyzést beemelte a publikus oldalról. A szkript
újrafuttatható, és a legújabb tartalomjegyzéket mindig a Drupal archívumlapjairól
állapítja meg.

A publikus cikkoldalak a szerzői taxonómiát megjelenítik, a témacímkéket viszont
nem. Ezért a 25 kiegészítő cikk címkéit a meglévő 236 elemes címkekészletből,
a cím és a törzsszöveg előfordulásai alapján rendeli hozzá a migráció. Ezt a
`manifest.json` és az egyedi cikkfájlok `migration.tagSource` mezője is jelöli.

## Médiafájlok

Az SQL a fájlok metaadatait és útvonalait tartalmazza, magukat a fájlbájtokat
nem. A dump 4 076 kezelt fájlrekordja körülbelül 200 MB adatra hivatkozott, de a
régi Drupal-tartalmak emellett több száz, fájltáblában nem szereplő állományra
is közvetlen HTML-hivatkozást tartalmaztak. A migráció ezért nemcsak a fájltáblát,
hanem mind az 1 216 cikk és 77 archív oldal HTML-jét is végigvizsgálja.

Összesen 3 024 különböző, tényleges tartalombeli médiaútvonalat ellenőriztünk.
A dump kezelt fájljai, a régi inline állományok és a dump utáni cikkek médiái
együtt körülbelül 399 MB-ot foglalnak. A 4 709 katalógusrekordból 4 700 fájl
helyben elérhető. Kilenc, az SQL-ben még szereplő állomány az eredeti szerveren
is HTTP 404 választ ad, de ezekre a végleges tartalom már nem hivatkozik. További
12 megszűnt inline képhivatkozást a migráció törött kép helyett szövegvesztés
nélkül eltávolított, két galérialinket pedig a megőrzött bélyegképre irányított.

## Újraépítés és ellenőrzés

1. A MariaDB dumpok visszaállítása után futtatandó:
   `python3 scripts/export_site_data.py`.
2. A kezelt fájlok letöltése: `python3 scripts/download_media.py`.
3. A dump utáni cikkek és a közvetlen inline média szinkronja:
   `python3 scripts/supplement_live_articles.py`.
4. A hiányzó szerkeszthető Markdown-cikkek és szerzők létrehozása:
   `npm run migrate:markdown`.
5. A teljes integritás-, adatvédelmi, média- és Markdown-ellenőrzés:
   `npm run migrate:validate`.

Az utolsó ellenőrzés hibával leáll, ha eltérnek a darabszámok, sérült az SQLite,
árva kapcsolat, veszélyes HTML, privát Drupal-adat vagy hiányzó tartalombeli
média marad az exportban.

## További szerkesztés

A történeti export változatlan, generált archívumként marad a
`content/migrated/tanitani` könyvtárban. Minden migrált cikk szerkeszthető
Markdown-példánya a `content/cikkek`, minden szerzőé a `content/szerzok`
mappában található, így az adminfelület a teljes publikus cikkarchívumot kezeli.

A Markdown front matterében lévő `migratedId` kapcsolja a szerkeszthető cikket
az eredeti archív rekordhoz. A build a címet, szerzőt, dátumot, témaköröket,
összefoglalót, borítóképet, olvasásszámot és törzsszöveget Markdownból olvassa,
miközben a hozzászólásokat, csatolmányokat, rovat- és lapszámadatokat, valamint a
régi slugot az archív JSON-ból őrzi meg. A `migrate:markdown` ismételt futtatása
nem írja felül a már létező Markdown-fájlokat, csak az újonnan importált
cikkekhez és szerzőkhöz készít újakat.
