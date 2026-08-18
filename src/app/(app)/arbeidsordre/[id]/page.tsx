import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, Lightbulb } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { liknendeSaker } from "@/lib/sok";
import { NESTE_STATUS, ORDRE_STATUS, ORDRE_TYPE, PRIORITET } from "@/lib/domene";
import { dato, datoTid, kroner, ordreNummer, relativTid, tall, timer, toNumber } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th, Tr } from "@/components/ui";
import {
  DeleSkjema,
  KommentarSkjema,
  LosningSkjema,
  Sjekkliste,
  StatusKnapper,
  TimeSkjema,
} from "./handlinger";
import {
  endreStatus,
  kryssAvSjekkpunkt,
  lagreLosning,
  leggTilKommentar,
  registrerDeleuttak,
  registrerTimer,
} from "../actions";

export async function generateMetadata(
  props: PageProps<"/arbeidsordre/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const o = await db.workOrder.findFirst({
    where: { id },
    select: { number: true, title: true },
  });
  return { title: o ? `${ordreNummer(o.number)} ${o.title}` : "Arbeidsordre" };
}

export default async function OrdreSide(props: PageProps<"/arbeidsordre/[id]">) {
  const { id } = await props.params;
  const { db, session } = await requireTenant();

  const ordre = await db.workOrder.findFirst({
    where: { id },
    include: {
      asset: { select: { id: true, code: true, name: true, location: true } },
      requestedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      pmPlan: { select: { id: true, name: true } },
      checklist: { orderBy: { sortOrder: "asc" } },
      timeEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { workedOn: "desc" },
      },
      partUsages: {
        include: { part: { select: { number: true, name: true, unit: true } } },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ordre) notFound();

  const [deler, liknende] = await Promise.all([
    db.part.findMany({
      where: { isActive: true },
      select: { id: true, number: true, name: true, unit: true, quantityOnHand: true },
      orderBy: { number: "asc" },
    }),
    liknendeSaker(session.organizationId, {
      id: ordre.id,
      title: ordre.title,
      description: ordre.description,
      assetId: ordre.assetId,
    }),
  ]);

  const arbeidskost = ordre.timeEntries.reduce(
    (s, t) => s + t.hours * toNumber(t.hourlyRate),
    0,
  );
  const delekost = ordre.partUsages.reduce(
    (s, p) => s + p.quantity * toNumber(p.unitCost),
    0,
  );
  const sumTimer = ordre.timeEntries.reduce((s, t) => s + t.hours, 0);
  const iDag = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link
        href="/arbeidsordre"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle arbeidsordre
      </Link>

      <div className="mb-6">
        <p className="font-mono text-sm text-tekst-svak">{ordreNummer(ordre.number)}</p>
        <h1 className="mt-0.5 text-xl font-semibold text-tekst">{ordre.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge className={ORDRE_STATUS[ordre.status].klasse}>
            {ORDRE_STATUS[ordre.status].tekst}
          </Badge>
          <Badge className={PRIORITET[ordre.priority].klasse}>
            {PRIORITET[ordre.priority].tekst}
          </Badge>
          <Badge className={ORDRE_TYPE[ordre.type].klasse}>
            {ORDRE_TYPE[ordre.type].tekst}
          </Badge>
          <span className="text-xs text-tekst-svakest">
            meldt av {ordre.requestedBy.name} {relativTid(ordre.createdAt)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Venstre kolonne: selve arbeidet ── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Neste steg" description="Flytt ordren videre i arbeidsflyten" />
            <CardBody>
              <StatusKnapper
                nåværende={ordre.status}
                muligeSteg={NESTE_STATUS[ordre.status]}
                endre={endreStatus.bind(null, ordre.id)}
              />
            </CardBody>
          </Card>

          {ordre.description && (
            <Card>
              <CardHeader title="Beskrivelse" />
              <CardBody className="text-sm whitespace-pre-wrap text-tekst">
                {ordre.description}
              </CardBody>
            </Card>
          )}

          {ordre.checklist.length > 0 && (
            <Card>
              <CardHeader
                title="Sjekkliste"
                description={`${ordre.checklist.filter((p) => p.isDone).length} av ${ordre.checklist.length} utført`}
              />
              <CardBody className="pt-2">
                <Sjekkliste
                  punkter={ordre.checklist}
                  kryss={kryssAvSjekkpunkt.bind(null, ordre.id)}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Løsning"
              description="Fylles ut når jobben er gjort"
            />
            <CardBody>
              <LosningSkjema
                lagre={lagreLosning.bind(null, ordre.id)}
                standard={{
                  resolution: ordre.resolution,
                  failureCode: ordre.failureCode,
                  downtimeMinutes: ordre.downtimeMinutes,
                }}
              />
            </CardBody>
          </Card>

          {/* Tidligere saker som ligner — systemets institusjonelle hukommelse */}
          {liknende.length > 0 && (
            <Card>
              <CardHeader
                title="Dette har skjedd før"
                description="Liknende saker fra historikken, med det som løste dem"
                action={<Lightbulb className="size-5 text-amber-500" aria-hidden />}
              />
              <ul className="divide-y divide-kant">
                {liknende.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <Link
                      href={`/arbeidsordre/${t.id}`}
                      className="text-sm font-medium text-tekst hover:text-aksent"
                    >
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-tekst-svak">
                      {ordreNummer(t.number)}
                      {t.assetCode && ` · ${t.assetCode}`}
                      {" · "}
                      {dato(t.createdAt)}
                      {t.failureCode && ` · ${t.failureCode}`}
                    </p>
                    {t.resolution && (
                      <p className="mt-1.5 line-clamp-3 text-sm text-tekst-svak">
                        {t.resolution}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Kommentarer" description={`${ordre.comments.length} innlegg`} />
            {ordre.comments.length > 0 && (
              <ul className="divide-y divide-kant">
                {ordre.comments.map((k) => (
                  <li key={k.id} className="px-5 py-3">
                    <p className="text-xs text-tekst-svak">
                      <span className="font-medium text-tekst">{k.user.name}</span>
                      {" · "}
                      {datoTid(k.createdAt)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-tekst">{k.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <CardBody className="border-t border-kant">
              <KommentarSkjema leggTil={leggTilKommentar.bind(null, ordre.id)} />
            </CardBody>
          </Card>
        </div>

        {/* ── Høyre kolonne: fakta og registreringer ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Detaljer" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Rad navn="Utstyr">
                  {ordre.asset ? (
                    <Link href={`/anlegg/${ordre.asset.id}`} className="text-aksent hover:text-aksent">
                      {ordre.asset.code} — {ordre.asset.name}
                    </Link>
                  ) : (
                    <span className="text-tekst-svakest">Ikke knyttet til utstyr</span>
                  )}
                </Rad>
                <Rad navn="Tildelt">
                  {ordre.assignedTo?.name ?? <span className="text-tekst-svakest">Ikke tildelt</span>}
                </Rad>
                <Rad navn="Meldt">{datoTid(ordre.createdAt)}</Rad>
                <Rad navn="Frist">{ordre.dueDate ? dato(ordre.dueDate) : "–"}</Rad>
                <Rad navn="Planlagt">{ordre.plannedDate ? dato(ordre.plannedDate) : "–"}</Rad>
                {ordre.completedAt && <Rad navn="Utført">{datoTid(ordre.completedAt)}</Rad>}
                {ordre.pmPlan && (
                  <Rad navn="Fra plan">
                    <Link href="/forebyggende" className="text-aksent hover:text-aksent">
                      {ordre.pmPlan.name}
                    </Link>
                  </Rad>
                )}
                {ordre.downtimeMinutes != null && (
                  <Rad navn="Nedetid">{timer(ordre.downtimeMinutes / 60)}</Rad>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Kostnad" description="Registrert på denne ordren" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <Rad navn="Arbeid">
                  {kroner(arbeidskost)}
                  <span className="ml-1 text-xs text-tekst-svakest">({tall(sumTimer, 2)} t)</span>
                </Rad>
                <Rad navn="Deler">{kroner(delekost)}</Rad>
                <div className="flex justify-between border-t border-kant pt-2 font-semibold text-tekst">
                  <dt>Sum</dt>
                  <dd>{kroner(arbeidskost + delekost)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Timeføring" />
            {ordre.timeEntries.length > 0 && (
              <Table>
                <tbody>
                  {ordre.timeEntries.map((t) => (
                    <Tr key={t.id}>
                      <Td className="text-xs whitespace-nowrap text-tekst-svak">
                        {dato(t.workedOn)}
                      </Td>
                      <Td className="text-sm">{t.user.name}</Td>
                      <Td className="text-right text-sm font-medium tabular-nums">
                        {tall(t.hours, 2)} t
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <CardBody className="border-t border-kant">
              <TimeSkjema registrer={registrerTimer.bind(null, ordre.id)} iDag={iDag} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Deler brukt" />
            {ordre.partUsages.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>Del</Th>
                    <Th className="text-right">Antall</Th>
                    <Th className="text-right">Kost</Th>
                  </tr>
                </thead>
                <tbody>
                  {ordre.partUsages.map((p) => (
                    <Tr key={p.id}>
                      <Td className="text-sm">
                        <span className="font-mono text-xs text-tekst-svak">{p.part.number}</span>
                        <br />
                        {p.part.name}
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        {tall(p.quantity)} {p.part.unit}
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        {kroner(p.quantity * toNumber(p.unitCost))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <CardBody className="border-t border-kant">
              <DeleSkjema
                registrer={registrerDeleuttak.bind(null, ordre.id)}
                deler={deler.map((d) => ({
                  id: d.id,
                  number: d.number,
                  name: d.name,
                  unit: d.unit,
                  beholdning: d.quantityOnHand,
                }))}
              />
            </CardBody>
          </Card>

          {ordre.asset && (
            <Card>
              <CardHeader
                title="Historikk på utstyret"
                action={<History className="size-4 text-tekst-svakest" aria-hidden />}
              />
              <CardBody>
                <Link
                  href={`/anlegg/${ordre.asset.id}`}
                  className="text-sm text-aksent hover:text-aksent"
                >
                  Se alt som er gjort på {ordre.asset.code} →
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Rad({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-tekst-svak">{navn}</dt>
      <dd className="text-right text-tekst">{children}</dd>
    </div>
  );
}
