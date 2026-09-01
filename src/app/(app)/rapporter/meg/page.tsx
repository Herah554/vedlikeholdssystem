import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { requireModul } from "@/lib/auth";
import { hentMaling, maalingTillater } from "@/lib/medarbeiderdata";
import { andel, leggTilTrend, OMGANG_DAGER } from "@/lib/medarbeidere";
import { tall, timer as timerTekst } from "@/lib/format";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Mitt arbeid" };

const PERIODER = [
  { dager: 30, tekst: "30 dager" },
  { dager: 90, tekst: "90 dager" },
  { dager: 365, tekst: "Året" },
];

/**
 * Den enkeltes egne tall.
 *
 * Dette er halve poenget med å måle i det hele tatt. Tall du ikke får se
 * oppleves som overvåkning; tall du får se blir tilbakemelding. Den som ser
 * at hen mangler skrevet løsning på halvparten av jobbene, retter det selv
 * i løpet av en uke — uten at noen har hatt en samtale om det.
 *
 * Sida er også det som gjør ledervisningen lettere å forsvare: et system der
 * den ansatte ser sine egne tall står seg annerledes overfor en tillitsvalgt
 * enn et der bare sjefen ser dem.
 */
export default async function MineTallSide(props: PageProps<"/rapporter/meg">) {
  const { db, session } = await requireModul("rapporter");

  const org = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { personMaling: true },
  });

  // Har bedriften slått av måling av enkeltpersoner, gjelder det også egne
  // tall. Ellers ville innstillingen vært halvveis.
  if (!maalingTillater(org.personMaling).egne) notFound();

  const sp = await props.searchParams;
  const valgt = PERIODER.find((p) => String(p.dager) === sp.dager) ?? PERIODER[1];

  // Tjenerkomponent: tegnes én gang per forespørsel, så «nå» står stille.
   
  const naa = new Date();
  const fra = new Date(naa.getTime() - valgt.dager * 86400_000);
  const forrigeFra = new Date(fra.getTime() - valgt.dager * 86400_000);

  const [denne, forrige] = await Promise.all([
    hentMaling(db, fra, naa, session.userId),
    hentMaling(db, forrigeFra, fra, session.userId),
  ]);

  const meg = leggTilTrend(denne, forrige)[0];

  return (
    <>
      <Link
        href="/rapporter"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle rapporter
      </Link>

      <PageHeader
        title="Mitt arbeid"
        description={`Det du har fullført siste ${valgt.tekst.toLowerCase()}`}
        action={
          <div className="flex items-center gap-1">
            {PERIODER.map((p) => (
              <Link
                key={p.dager}
                href={`/rapporter/meg?dager=${p.dager}`}
                className={
                  p.dager === valgt.dager
                    ? "rounded-lg bg-flate-dempet px-3 py-2 text-sm font-medium text-tekst"
                    : "rounded-lg px-3 py-2 text-sm text-tekst-svak hover:bg-flate-dempet"
                }
              >
                {p.tekst}
              </Link>
            ))}
          </div>
        }
      />

      {!meg || (meg.utfort === 0 && meg.timer === 0) ? (
        <Card>
          <EmptyState
            title="Ingenting registrert i perioden"
            description="Her dukker det opp tall når du har fullført jobber eller ført timer."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tall
              navn="Fullført"
              verdi={String(meg.utfort)}
              under={`${meg.tunge} kritiske eller høy prioritet`}
              trend={meg.forrige ? meg.utfort - meg.forrige.utfort : null}
            />
            <Tall
              navn="Timer ført"
              verdi={timerTekst(meg.timer)}
              under={
                meg.tilgjengelig > 0
                  ? `av ${timerTekst(meg.tilgjengelig)} tilgjengelig`
                  : undefined
              }
              trend={meg.forrige ? meg.timer - meg.forrige.timer : null}
              enTime
            />
            <Tall
              navn="Skrutid"
              verdi={meg.skrutid == null ? "–" : `${Math.round(meg.skrutid * 100)} %`}
              under="Av tiden du var på jobb"
            />
            <Tall
              navn="Dokumentert"
              verdi={
                andel(meg.dokumentert, meg.utfort) == null
                  ? "–"
                  : `${andel(meg.dokumentert, meg.utfort)} %`
              }
              under={`${meg.dokumentert} av ${meg.utfort} har skrevet løsning`}
            />
          </div>

          <Card>
            <CardHeader title="Hva tallene betyr" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Rad
                  navn="Skrutid"
                  verdi={
                    meg.skrutid == null
                      ? "Ingen timer per dag satt på deg"
                      : `${Math.round(meg.skrutid * 100)} %`
                  }
                >
                  Andelen av arbeidstiden din som er ført på jobber. Er den lav,
                  er det som regel ikke deg det står på — det er venting på
                  deler, leting etter tegninger og møter. Eller så er det timer
                  som ikke er ført. Tallet forutsetter at all arbeidstid havner
                  på en arbeidsordre, og ferie er ikke trukket fra.
                </Rad>

                <Rad
                  navn="Mot anslag"
                  verdi={
                    meg.motAnslag == null ? "Ingen anslag" : `${tall(meg.motAnslag, 2)}×`
                  }
                >
                  Timene dine delt på det som var anslått. Sier mest om hvor
                  gode anslagene er — de settes ofte av en annen enn den som
                  gjør jobben.
                </Rad>

                <Rad
                  navn="I tide"
                  verdi={
                    andel(meg.iTide, meg.medFrist) == null
                      ? "Ingen jobber hadde frist"
                      : `${andel(meg.iTide, meg.medFrist)} % av ${meg.medFrist}`
                  }
                >
                  Av jobbene som hadde en frist. Jobber uten frist teller ikke.
                </Rad>

                <Rad
                  navn="Omgang"
                  verdi={
                    andel(meg.omganger, meg.medUtstyr) == null
                      ? "Ingen jobber på utstyr"
                      : `${meg.omganger} av ${meg.medUtstyr}`
                  }
                >
                  Utstyr du var på som fikk en ny korrektiv jobb innen{" "}
                  {OMGANG_DAGER} dager. En maskin kan ryke av noe helt annet, så
                  tallet er en pekepinn og ikke en dom.
                </Rad>
              </dl>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}

function Tall({
  navn,
  verdi,
  under,
  trend,
  enTime,
}: {
  navn: string;
  verdi: string;
  under?: string;
  /** Endring fra forrige periode. Null når det ikke finnes noe å sammenlikne med. */
  trend?: number | null;
  enTime?: boolean;
}) {
  return (
    <div className="rounded-xl border border-kant bg-flate p-4">
      <p className="text-sm text-tekst-svak">{navn}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-tekst tabular-nums">{verdi}</span>
        {trend != null && trend !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs ${
              trend > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-tekst-svak"
            }`}
          >
            {trend > 0 ? (
              <TrendingUp className="size-3.5" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden />
            )}
            {trend > 0 ? "+" : ""}
            {enTime ? timerTekst(Math.abs(trend)) : Math.abs(trend)}
          </span>
        )}
        {trend === 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-tekst-svakest">
            <Minus className="size-3.5" aria-hidden />
            uendret
          </span>
        )}
      </p>
      {under && <p className="mt-1 text-xs text-tekst-svak">{under}</p>}
    </div>
  );
}

function Rad({
  navn,
  verdi,
  children,
}: {
  navn: string;
  verdi: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-kant pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="font-medium text-tekst">{navn}</dt>
        <dd className="text-sm text-tekst tabular-nums">{verdi}</dd>
      </div>
      <p className="mt-1 text-xs text-tekst-svak">{children}</p>
    </div>
  );
}
