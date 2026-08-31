import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { kanSession, requireModul } from "@/lib/auth";
import { andel, malMedarbeidere, OMGANG_DAGER } from "@/lib/medarbeidere";
import { tall, timer as timerTekst } from "@/lib/format";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const metadata: Metadata = { title: "Medarbeidere" };

const PERIODER = [
  { dager: 30, tekst: "30 dager" },
  { dager: 90, tekst: "90 dager" },
  { dager: 365, tekst: "Året" },
];

/**
 * Hvordan arbeidet fordeler seg på folk.
 *
 * Siden er sperret bak «administrere» på arbeidsordre — nivået som i
 * rettighetsoppsettet beskrives som «Godkjenne, tildele og lukke». Det er de
 * som leder arbeidet. Tall om navngitte kolleger skal ikke ligge åpent for
 * alle som kan se rapporter, og modultilgangen alene skiller ikke de to.
 *
 * Regnestykket ligger i src/lib/medarbeidere.ts, ikke her, slik at det kan
 * kjøres i en test. Et feil tall her får følger for en person.
 */
export default async function MedarbeidereSide(
  props: PageProps<"/rapporter/medarbeidere">,
) {
  const { db, session } = await requireModul("rapporter");

  // Svarer «finnes ikke» framfor «ingen tilgang», slik resten av systemet
  // gjør — ellers kan man kartlegge hva som finnes ved å prøve adresser.
  if (!kanSession(session, "arbeidsordre", "administrere")) notFound();

  const sp = await props.searchParams;
  const valgt = PERIODER.find((p) => String(p.dager) === sp.dager) ?? PERIODER[1];
  // Tjenerkomponent: tegnes én gang per forespørsel, så «nå» står stille
  // gjennom hele sida. Regelen skiller ikke tjener fra klient.
  // eslint-disable-next-line react-hooks/purity
  const fra = new Date(Date.now() - valgt.dager * 86400_000);

  const [ordrer, timeforing, folk, korrektive] = await Promise.all([
    db.workOrder.findMany({
      where: { completedAt: { gte: fra } },
      select: {
        id: true,
        assignedToId: true,
        assetId: true,
        priority: true,
        estimatedHours: true,
        dueDate: true,
        completedAt: true,
        resolution: true,
      },
    }),
    db.timeEntry.groupBy({
      by: ["userId"],
      _sum: { hours: true },
      where: { workedOn: { gte: fra } },
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ["TEKNIKER", "DELELAGER", "PLANLEGGER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Korrektive jobber fra perioden og framover, slik at en reparasjon helt
    // i slutten av perioden også kan få en omgang mot seg.
    db.workOrder.findMany({
      where: { type: "KORREKTIV", createdAt: { gte: fra } },
      select: { id: true, assetId: true, createdAt: true },
    }),
  ]);

  const timerPer = new Map(
    timeforing.map((t) => [t.userId, t._sum.hours ?? 0]),
  );

  const personer = folk.map((b) => ({ id: b.id, navn: b.name }));

  const maling = malMedarbeidere(ordrer, personer, timerPer, korrektive).filter(
    // Den som verken har fullført noe eller ført timer i perioden sier
    // ingenting, og en rad med bare nuller ser ut som en dom.
    (m) => m.utfort > 0 || m.timer > 0,
  );

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
        title="Medarbeidere"
        description={`Fullført arbeid siste ${valgt.tekst.toLowerCase()}`}
        action={
          <div className="flex items-center gap-1">
            {PERIODER.map((p) => (
              <Link
                key={p.dager}
                href={`/rapporter/medarbeidere?dager=${p.dager}`}
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

      <Card className="mb-4">
        <CardBody>
          <p className="flex items-start gap-2 text-sm text-tekst-svak">
            <Info className="mt-0.5 size-4 shrink-0 text-tekst-svakest" aria-hidden />
            <span>
              <strong className="font-medium text-tekst">
                Det finnes ikke ett tall for hvor god en tekniker er.
              </strong>{" "}
              Antall jobber favoriserer den som tar de korte, og timer
              favoriserer den som bruker lang tid. Derfor står målene ved siden
              av hverandre, sammen med hvor tunge jobber hver enkelt fikk. Les
              kolonnene sammen — én lav verdi alene betyr sjelden noe.
            </span>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Fullført arbeid"
          description={`${maling.length} med aktivitet i perioden`}
        />
        {maling.length === 0 ? (
          <EmptyState
            title="Ingen fullførte jobber i perioden"
            description="Velg en lengre periode, eller kom tilbake når det er ført arbeid."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Navn</Th>
                  <Th className="text-right">Utført</Th>
                  <Th className="text-right">Tunge</Th>
                  <Th className="text-right">Timer</Th>
                  <Th className="text-right">Mot anslag</Th>
                  <Th className="text-right">I tide</Th>
                  <Th className="text-right">Dokumentert</Th>
                  <Th className="text-right">Omgang</Th>
                </tr>
              </thead>
              <tbody>
                {maling.map((m) => {
                  const iTide = andel(m.iTide, m.medFrist);
                  const dok = andel(m.dokumentert, m.utfort);
                  const omgang = andel(m.omganger, m.medUtstyr);

                  return (
                    <Tr key={m.brukerId}>
                      <Td className="text-sm font-medium text-tekst">{m.navn}</Td>
                      <Td className="text-right text-sm tabular-nums">{m.utfort}</Td>
                      <Td className="text-right text-sm tabular-nums text-tekst-svak">
                        {m.tunge}
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        {timerTekst(m.timer)}
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        {m.motAnslag == null ? (
                          <span className="text-tekst-svakest">–</span>
                        ) : (
                          <span
                            title={`Bygger på ${m.medAnslag} ${m.medAnslag === 1 ? "jobb" : "jobber"} med anslag`}
                          >
                            {tall(m.motAnslag, 2)}×
                          </span>
                        )}
                      </Td>
                      <Prosent verdi={iTide} nevner={m.medFrist} hoytErBra />
                      <Prosent verdi={dok} nevner={m.utfort} hoytErBra />
                      <Prosent
                        verdi={omgang}
                        nevner={m.medUtstyr}
                        hoytErBra={false}
                      />
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        <CardBody className="border-t border-kant">
          <dl className="space-y-2 text-xs text-tekst-svak">
            <Forklaring navn="Tunge">
              Av de fullførte: hvor mange var kritiske eller høy prioritet. Uten
              denne ser den som tar de tre verste havariene i måneden bare ut
              som treg.
            </Forklaring>
            <Forklaring navn="Mot anslag">
              Førte timer delt på anslåtte, for jobbene som har et anslag. Sier
              mest om hvor gode anslagene er — de settes ofte av en annen enn
              den som gjør jobben.
            </Forklaring>
            <Forklaring navn="I tide">
              Fullført innen fristen, av dem som hadde en frist. Jobber uten
              frist teller ikke mot noen.
            </Forklaring>
            <Forklaring navn="Dokumentert">
              Andel med skrevet løsning. Det er denne teksten assistenten og
              søket finner igjen neste gang noen møter samme feil.
            </Forklaring>
            <Forklaring navn="Omgang">
              Utstyret fikk en ny korrektiv jobb innen {OMGANG_DAGER} dager.
              Nærmeste ærlige mål på om reparasjonen holdt — men en maskin kan
              også ryke av noe helt annet, så les tallet med skjønn.
            </Forklaring>
          </dl>
        </CardBody>
      </Card>
    </>
  );
}

function Forklaring({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-tekst">{navn}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}

/**
 * En andel, eller en strek når det ikke er noe å regne på.
 *
 * Null nevner gir strek og ikke null prosent. «0 %» ser ut som en dom over
 * noen som aldri fikk en eneste jobb med frist.
 */
function Prosent({
  verdi,
  nevner,
  hoytErBra,
}: {
  verdi: number | null;
  nevner: number;
  hoytErBra: boolean;
}) {
  if (verdi == null) {
    return (
      <Td className="text-right text-sm text-tekst-svakest">–</Td>
    );
  }

  const bra = hoytErBra ? verdi >= 80 : verdi <= 10;
  const daarlig = hoytErBra ? verdi < 50 : verdi > 30;

  return (
    <Td className="text-right text-sm tabular-nums">
      <span
        className={
          bra
            ? "text-emerald-700 dark:text-emerald-400"
            : daarlig
              ? "text-amber-700 dark:text-amber-400"
              : "text-tekst"
        }
        title={`Av ${nevner} ${nevner === 1 ? "jobb" : "jobber"}`}
      >
        {verdi} %
      </span>
    </Td>
  );
}
