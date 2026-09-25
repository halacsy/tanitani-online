# Piszkozatmentés és publikálási folyamat

A #13 feladat megvalósítása. Ez a leírás a `public/admin` alatti Decap CMS-re
vonatkozik.

A CMS-ben be van kapcsolva a szerkesztői folyamat
(`publish_mode: editorial_workflow`). A **Mentés** ettől kezdve nem a `main`
ágra ír, tehát önmagában semmi nem kerül ki az élő oldalra.

## Mi történik mentéskor

| Lépés | Hol jelenik meg | Mi történik a repositoryban |
| --- | --- | --- |
| Új cikk → **Mentés** | Szerkesztői Folyamat → *Piszkozat* | létrejön a `cms/cikkek/<slug>` ág és egy pull request |
| Újabb **Mentés** | ugyanaz a kártya | újabb commit ugyanarra az ágra |
| Kártya húzása *Vizsgálat alatt* oszlopba | *Vizsgálat alatt* | a pull request `decap-cms/pending_review` címkét kap |
| Kártya húzása *Kész* oszlopba | *Kész* | a címke `decap-cms/pending_publish` lesz |
| **Publikálás most** | a cikk eltűnik a tábláról | a pull request egyetlen commitként a `main` ágra kerül (`squash_merges`), az ág törlődik |

A félkész cikk tehát addig marad piszkozat, amíg valaki rá nem nyomja a
**Publikálás most** gombot. A piszkozat bármikor folytatható: az admin bal
felső **Szerkesztői Folyamat** menüpontjában ott a kártya, ugyanazzal a
tartalommal.

## Előnézet publikálás előtt

- A szerkesztőben a jobb oldali élő előnézet azonnal mutatja a cikket a
  publikus oldal kinézetével (`public/admin/preview.js`).
- A pull requesthez a Netlify külön **Deploy Preview** címet épít. Amint elkészül,
  a szerkesztő fejlécében aktívvá válik az **Előnézet megtekintése** gomb, és a
  teljes oldal végigjárható a piszkozattal együtt.
- Az előnézeti build a saját címét használja kanonikus URL-ként, és a
  `robots.txt` letiltja az indexelését, így a piszkozat nem kerül a keresőkbe.

## Ki mit tehet

- Belépni és menteni az tud, akinek a `halacsy/tanitani-online` repositoryhoz
  írási (`write`) jogosultsága van; a belépés GitHub-fiókkal, a Netlify OAuth
  szolgáltatásán keresztül történik.
- Publikálni ugyanez a kör tud. Ha a publikálást szűkíteni kell, a GitHubon a
  `main` ágra kell védelmi szabályt (branch protection) tenni; ilyenkor a
  **Publikálás most** gomb hibát ad, és a pull requestet a GitHubon kell
  jóváhagyni és egyesíteni.
- A `main` ágra került változást a Netlify automatikusan kiadja.

## Ha elakad egy piszkozat

A tábla kártyái mögött valódi pull requestek állnak. Ha egy kártya beragad
(például kézzel is módosították az ágat), a GitHubon kell rendezni: a pull
requestet egyesíteni vagy lezárni, és a `cms/…` ágat törölni. A tábla a
következő betöltéskor frissül.
