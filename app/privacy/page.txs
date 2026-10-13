import Link from 'next/link'

export const metadata = {
  title: 'Adatvédelmi nyilatkozat · Scale',
  description: 'Hogyan kezeli a Scale a felhasználók adatait.',
}

const CONTACT_EMAIL = 'matemajzik47@gmail.com'

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-10 text-[#111214]">
      <h1 className="text-3xl font-extrabold tracking-tight">Adatvédelmi nyilatkozat</h1>
      <p className="mt-2 text-sm text-neutral-500">Utolsó frissítés: 2026. október 13.</p>

      <div className="mt-8 flex flex-col gap-7 text-[15px] leading-relaxed text-neutral-700">
        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Ki üzemelteti a Scale-t?</h2>
          <p>
            A Scale (scale-hungary.vercel.app) egy magyar zenei értékelő oldal, amelyet magánszemély
            üzemeltet. Adatvédelmi kérdésekkel a{' '}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{' '}
            címen érhető el.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Milyen adatokat kezelünk?</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Fiókadatok:</b> e-mail cím és a választott felhasználónév. Google-fiókkal történő
              belépésnél a Google átadja az e-mail címedet, a nevedet és a profilképed címét.
            </li>
            <li>
              <b>Értékelések:</b> az általad adott pontszámok, és az ezekből számolt statisztikák
              (értékelések száma, napi széria, szint, átlagpontszám).
            </li>
            <li>
              <b>Technikai adatok:</b> a bejelentkezéshez szükséges munkamenet-adatok.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Mire használjuk?</h2>
          <p>
            Kizárólag a Scale működtetésére: bejelentkezés, a profilod és a Music ID kártyád
            megjelenítése, a közösségi átlagpontszámok kiszámítása. A felhasználónevedet és az
            értékeléseidet a profilod nyilvános oldalán más felhasználók is láthatják. Az e-mail
            címedet nem jelenítjük meg másoknak.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Kinek adjuk át?</h2>
          <p>
            Adataidat nem adjuk el, és hirdetési célra nem használjuk. Az adatok tárolását és az
            oldal kiszolgálását külső szolgáltatók végzik: Supabase (adatbázis és bejelentkezés),
            Vercel (tárhely), Google (bejelentkezés Google-fiókkal).
          </p>
          <p className="mt-2">
            A Scale a Google-tól kapott adatokat kizárólag a bejelentkezéshez és a fiókod
            létrehozásához használja, és megfelel a Google API Services User Data Policy
            előírásainak, beleértve a Limited Use követelményeket is.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Megőrzés és törlés</h2>
          <p>
            Az adataidat addig őrizzük, amíg a fiókod létezik. Kérheted a fiókod és az összes
            hozzá tartozó adat (értékelések, statisztikák) törlését a fenti e-mail címen.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-[#111214]">Jogaid</h2>
          <p>
            Kérheted az adataid megismerését, helyesbítését és törlését. Panasszal a Nemzeti
            Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhatsz.
          </p>
        </section>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm font-semibold underline">
        Vissza a főoldalra
      </Link>
    </main>
  )
}
