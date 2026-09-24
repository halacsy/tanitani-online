# Webcímek (ékezetmentes ASCII slugok)

A #12 feladat megvalósítása. Ez a leírás a `public/admin` alatti Decap CMS-re
és a publikus oldal slug-kezelésére vonatkozik.

Az új bejegyzések webcíme a címből készül, **ékezetek nélkül**:

- „Árvíztűrő tükörfúrógép” → `/cikkek/arvizturo-tukorfurogep`
- „Knausz Imre” → `/szerzok/knausz-imre`

A slug csak kisbetűs ASCII betűt, számot és egyszeres kötőjelet tartalmazhat.
A szabály egy helyen van leírva: `lib/slug.mjs`; a CMS oldalán a
`public/admin/config.yml` `slug:` blokkja (`encoding: ascii`,
`clean_accents: true`) állítja elő ugyanezt. Az admin előnézeti útvonala
(`preview_path`) és a publikus kanonikus URL ugyanazt a slugot használja.

Tudnivalók:

- **A webcím az első mentéskor rögzül.** A cím későbbi átírása nem nevezi át a
  fájlt, tehát a webcím sem változik. Ezért érdemes a címet a mentés előtt
  véglegesíteni.
- **Ütköző webcím**: ha a slug már foglalt, a CMS sorszámot tesz a végére
  (`arvizturo-tukorfurogep-1`).
- **Kézi átnevezés** csak a repositoryban lehetséges: a `content/cikkek/<slug>.md`
  fájl átnevezésével. A régi webcím ilyenkor sem törik el, mert az oldal az
  ékezet- és elválasztófüggetlen alak alapján is megtalálja a cikket, és
  állandó átirányítással a kanonikus webcímre küld.
- **A migrált archívum fájlnevei érintetlenek.** A régi, aláhúzásos vagy
  ékezetes URL-ek (`/cikkek/az_izraeli_oktatásrol`) továbbra is működnek.

Ellenőrzés:

```bash
npm test                # a slugképzés egységtesztjei
npm run validate:slugs  # minden szerkesztői slug kanonikus-e
```

A `npm run migrate:validate` is lefuttatja a slug-ellenőrzést.
