# A cikk szövegének formázása

A #10 feladat megvalósítása. Ez a leírás a **Cikk szövege** mező Decap CMS
eszköztárára vonatkozik (`public/admin/config.yml`, `cikkek.body`).

## Miért nincs igazítás, betűméret és kézi behúzás

Az eszköztár nem a szövegszerkesztő programok vizuális formázását másolja,
hanem azt jelöli, mi a szövegrész *szerepe* (felsorolás, címsor, idézet, kód,
témaváltás). Ezért nincs jobbra/középre igazító gomb, tetszőleges betűméret és
kézi behúzásnövelés/-csökkentés – ezek keskeny és mobil nézetben
kiszámíthatatlanul törnek, és nem hordoznak jelentést. A megjelenést a webhely
egységesen, minden képernyőméreten megfelelően formázza.

## Az eszköztár szemantikus elemei

### Több összetartozó elem → felsorolás

```markdown
- első szempont
- második szempont
- harmadik szempont
```

Ha a sorrend számít, számozott lista:

```markdown
1. Első lépés
2. Második lépés
3. Harmadik lépés
```

### Fejezet vagy alfejezet → címsor

```markdown
## A fejezet címe

### Az alfejezet címe
```

A cím így a tartalom szerkezetének is része lesz, nem csak vizuálisan nagyobb
szöveg.

### Idézett szöveg → idézet

```markdown
> A pedagógia lényege nem fér el egyetlen mondatban.
```

### Kód vagy változtatás nélkül megőrzendő szöveg → kódblokk

Csak valódi kódhoz vagy olyan előformázott tartalomhoz használjuk, ahol a
sortörések és szóközök jelentést hordoznak. Közönséges bekezdés behúzására a
kódblokk nem való.

### Témaváltás → elválasztóvonal

A szerkesztőben a **+** gombbal, az **Elválasztóvonal** elem beszúrásával
adható hozzá (a mentett Markdownban `---` sorként jelenik meg).

## Előnézet

A szerkesztői élő előnézet és a Netlify Deploy Preview pontosan ugyanazt a
tipográfiát használja, mint a publikus cikkoldal (`public/admin/preview.css`
`.article-prose` szabályai megfelelnek az `app/globals.css` `.prose`
szabályainak). Ha egy szemantikus elem nem néz ki megfelelően, a globális
tipográfiát kell javítani, nem egyedi formázást bevezetni a cikkben.
