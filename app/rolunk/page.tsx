import Link from 'next/link'
import { getArchivePageBySlug } from '@/lib/pages'

export const metadata = {
  title: 'Rólunk',
}

export default function RolunkPage() {
  const history = getArchivePageBySlug('mi_ez')
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-8">
        A Taní-tani Online-ról
      </h1>

      <div className="prose">
        <p>
          A Taní-tani Online – <em>A szabad pedagógiai gondolkodás fóruma</em> – 1996-ban alakult, az Alternatív Közgazdasági Gimnázium Alapítványa és Oroszlány Péter kezdeményezésére. Kezdetben nyomtatott folyóiratként jelent meg, 2010 óta kizárólag online formában működik.
        </p>

        <h2>Küldetésünk</h2>
        <p>
          Célunk, hogy teret adjunk a progresszív, alternatív és kritikai pedagógiai gondolkodásnak Magyarországon. Olyan fórum vagyunk, ahol a pedagógusok, kutatók, szülők és minden érdeklődő megtalálhatják azokat az írásokat, amelyek az oktatás valódi kérdéseivel foglalkoznak – nem a tantervek és adminisztráció zsargonjában, hanem emberi és szakmai nyelven.
        </p>

        <h2>A tartalom</h2>
        <p>
          Több mint 600 szerzőtől, több mint 1000 cikk olvasható az oldalon – ingyenesen, Creative Commons licenc alatt. Az írások témái felölelik az oktatáspolitikát, a neveléstörténetet, az alternatív pedagógiákat, a hátrányos helyzet kérdéskörét, a digitális oktatást, a drámapedagógiát és még sok más területet.
        </p>

        <h2>A Taní-tani Könyvek</h2>
        <p>
          A szerkesztőség saját könyvkiadói tevékenységet is folytat: a <Link href="/archivum/konyvek/1">Taní-tani Könyvek</Link> sorozat kötetei szabadon hozzáférhetők – „szabad írás – szabad hozzáférés” alapon.
        </p>

        <h2>Kapcsolat</h2>
        <p>
          Ha cikket szeretne beküldeni, vagy kérdése van a szerkesztőséggel kapcsolatban, látogasson el a <Link href="/archivum/szerzoinknek">Szerzői útmutató</Link> oldalra, vagy <Link href="/archivum/kapcsolat_">írjon nekünk</Link>.
        </p>
        <p><Link href="/fomunkatarsaink">Főmunkatársaink</Link> · <Link href="/archivum/impresszum">Szerkesztőség és impresszum</Link></p>
        <h2 id="tortenet" className="scroll-mt-24">A nyomtatott folyóirat története</h2>
        <p><Link href="/folyoirat">A régi lapszámok és tartalomjegyzékek böngészése →</Link></p>
        {history && <div className="imported-html" dangerouslySetInnerHTML={{ __html: history.bodyHtml }} />}
      </div>
    </div>
  )
}
