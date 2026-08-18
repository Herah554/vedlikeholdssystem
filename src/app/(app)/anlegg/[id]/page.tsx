import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ANLEGG_STATUS,
  ANLEGG_TYPE,
  APNE_STATUSER,
  KRITIKALITET,
  ORDRE_STATUS,
  PRIORITET,
} from "@/lib/domene";
import { dato, kroner, ordreNummer, tall, toNumber } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export async function generateMetadata(
  props: PageProps<"/anlegg/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const a = await db.asset.findFirst({ where: { id }, select: { code: true, name: true } });
  return { title: a ? `${a.code} ${a.name}` : "Utstyr" };
}

export default async function UtstyrSide(props: PageProps<"/anlegg/[id]">) {
  const { id } = await props.params;
  const { db, session } = await requireTenant();

  const utstyr = await db.asset.findFirst({
    where: { id },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      children: {
        select: { id: true, code: true, name: true, type: true, status: true },
        orderBy: { code: "asc" },
      },
      costCenter: { select: { code: true, name: true } },
      parts: {
        include: {
          part: {
            select: { id: true, number: true, name: true, unit: true, quantityOnHand: true, minStock: true },
          },
        },
      },
      pmPlans: {
        where: { isActive: true },
        select: { id: true, name: true, nextDueAt: true, intervalDays: true },
        orderBy: { nextDueAt: "asc" },
      },
    },
  });

  if (!utstyr) notFound();

  // Historikk og kostnad hentes for hele deltreet, slik at et systemkort
  // også viser det som er gjort på utstyret under.
  const deltre = `${utstyr.path}%`;

  const [ordrer, kostnad] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId: session.organizationId,
        asset: { path: { startsWith: utstyr.path } },
      },
      include: { asset: { select: { code: true } }, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.$queryRaw<{ arbeid: number; deler: number; nedetid: number; antall: number }[]>`
      SELECT
        coalesce((SELECT sum(te.hours * te."hourlyRate") FROM time_entries te
                  JOIN work_orders w ON w.id = te."workOrderId"
                  JOIN assets a ON a.id = w."assetId"
                  WHERE te."organizationId" = ${session.organizationId}
                    AND a.path LIKE ${deltre}), 0)::float8 AS arbeid,
        coalesce((SELECT sum(pu.quantity * pu."unitCost") FROM part_usages pu
                  JOIN work_orders w ON w.id = pu."workOrderId"
                  JOIN assets a ON a.id = w."assetId"
                  WHERE pu."organizationId" = ${session.organizationId}
                    AND a.path LIKE ${deltre}), 0)::float8 AS deler,
        coalesce((SELECT sum(w."downtimeMinutes") FROM work_orders w
                  JOIN assets a ON a.id = w."assetId"
                  WHERE w."organizationId" = ${session.organizationId}
                    AND a.path LIKE ${deltre}), 0)::float8 AS nedetid,
        coalesce((SELECT count(*) FROM work_orders w
                  JOIN assets a ON a.id = w."assetId"
                  WHERE w."organizationId" = ${session.organizationId}
                    AND a.path LIKE ${deltre}), 0)::int AS antall
    `,
  ]);

  const k = kostnad[0] ?? { arbeid: 0, deler: 0, nedetid: 0, antall: 0 };
  const apneOrdrer = ordrer.filter((o) => APNE_STATUSER.includes(o.status));

  return (
    <>
      <Link
        href="/anlegg"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Anleggsstruktur
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {utstyr.parent && (
            <Link
              href={`/anlegg/${utstyr.parent.id}`}
              className="text-sm text-tekst-svak hover:text-aksent"
            >
              {utstyr.parent.code} — {utstyr.parent.name}
            </Link>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-sm text-tekst-svak">{utstyr.code}</span>
            <h1 className="text-xl font-semibold text-tekst">{utstyr.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{ANLEGG_TYPE[utstyr.type]}</Badge>
            <Badge className={ANLEGG_STATUS[utstyr.status].klasse}>
              {ANLEGG_STATUS[utstyr.status].tekst}
            </Badge>
            <Badge className={KRITIKALITET[utstyr.criticality].klasse}>
              Kritikalitet {utstyr.criticality} — {KRITIKALITET[utstyr.criticality].tekst}
            </Badge>
          </div>
        </div>
        <ButtonLink href={`/arbeidsordre/ny?utstyr=${utstyr.id}`}>
          <Plus className="size-4" aria-hidden />
          Meld feil på dette
        </ButtonLink>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Åpne jobber" value={apneOrdrer.length} tone={apneOrdrer.length ? "advarsel" : "god"} />
        <StatCard label="Arbeidsordre totalt" value={k.antall} />
        <StatCard label="Nedetid samlet" value={`${tall(k.nedetid / 60, 1)} t`} />
        <StatCard label="Kostnad samlet" value={kroner(k.arbeid + k.deler)} sub={`${kroner(k.arbeid)} arbeid · ${kroner(k.deler)} deler`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Historikk"
              description={`${ordrer.length} arbeidsordre${utstyr.children.length ? " på denne enheten og alt under" : ""}`}
            />
            {ordrer.length === 0 ? (
              <EmptyState title="Ingen arbeidsordre ennå" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-24">Nummer</Th>
                    <Th>Tittel</Th>
                    <Th className="hidden sm:table-cell">Dato</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {ordrer.map((o) => (
                    <Tr key={o.id}>
                      <Td className="font-mono text-xs text-tekst-svak">
                        {ordreNummer(o.number)}
                      </Td>
                      <Td>
                        <Link
                          href={`/arbeidsordre/${o.id}`}
                          className="text-sm font-medium text-tekst hover:text-aksent"
                        >
                          {o.title}
                        </Link>
                        {o.failureCode && (
                          <span className="ml-2 text-xs text-tekst-svakest">{o.failureCode}</span>
                        )}
                      </Td>
                      <Td className="hidden text-sm whitespace-nowrap text-tekst-svak sm:table-cell">
                        {dato(o.createdAt)}
                      </Td>
                      <Td>
                        <Badge className={ORDRE_STATUS[o.status].klasse}>
                          {ORDRE_STATUS[o.status].tekst}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {utstyr.children.length > 0 && (
            <Card>
              <CardHeader title="Underliggende enheter" />
              <ul className="divide-y divide-kant">
                {utstyr.children.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/anlegg/${b.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-flate-hover"
                    >
                      <span className="font-mono text-xs text-tekst-svak">{b.code}</span>
                      <span className="flex-1 text-sm font-medium text-tekst">{b.name}</span>
                      <Badge>{ANLEGG_TYPE[b.type]}</Badge>
                      <Badge className={ANLEGG_STATUS[b.status].klasse}>
                        {ANLEGG_STATUS[b.status].tekst}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Utstyrskort" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Rad navn="Produsent">{utstyr.manufacturer ?? "–"}</Rad>
                <Rad navn="Modell">{utstyr.modelNumber ?? "–"}</Rad>
                <Rad navn="Serienummer">{utstyr.serialNumber ?? "–"}</Rad>
                <Rad navn="Plassering">{utstyr.location ?? "–"}</Rad>
                <Rad navn="Installert">{utstyr.installedAt ? dato(utstyr.installedAt) : "–"}</Rad>
                <Rad navn="Garanti til">{utstyr.warrantyUntil ? dato(utstyr.warrantyUntil) : "–"}</Rad>
                <Rad navn="Innkjøpspris">
                  {utstyr.purchaseCost ? kroner(toNumber(utstyr.purchaseCost)) : "–"}
                </Rad>
                <Rad navn="Driftstimer">{tall(utstyr.runningHours)}</Rad>
                <Rad navn="Kostnadssted">
                  {utstyr.costCenter ? `${utstyr.costCenter.code} ${utstyr.costCenter.name}` : "–"}
                </Rad>
              </dl>
              {utstyr.description && (
                <p className="mt-4 border-t border-kant pt-4 text-sm text-tekst-svak">
                  {utstyr.description}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Reservedeler"
              description="Deler som passer denne enheten"
            />
            {utstyr.parts.length === 0 ? (
              <EmptyState title="Ingen deler koblet" description="Koble deler til utstyret for å gjøre dem lette å finne ved feil." />
            ) : (
              <ul className="divide-y divide-kant">
                {utstyr.parts.map((ap) => (
                  <li key={ap.id}>
                    <Link
                      href={`/reservedeler/${ap.part.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-flate-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-tekst-svak">{ap.part.number}</p>
                        <p className="truncate text-sm text-tekst">{ap.part.name}</p>
                      </div>
                      <Badge
                        className={
                          ap.part.quantityOnHand < ap.part.minStock
                            ? "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30"
                            : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30"
                        }
                      >
                        {tall(ap.part.quantityOnHand)} {ap.part.unit}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Forebyggende planer" />
            {utstyr.pmPlans.length === 0 ? (
              <EmptyState title="Ingen planer" description="Uten forebyggende plan blir alt vedlikehold på denne enheten brannslukking." />
            ) : (
              <ul className="divide-y divide-kant">
                {utstyr.pmPlans.map((p) => (
                  <li key={p.id} className="px-5 py-2.5">
                    <p className="text-sm font-medium text-tekst">{p.name}</p>
                    <p className="text-xs text-tekst-svak">
                      {p.intervalDays ? `Hver ${p.intervalDays}. dag` : "Etter driftstimer"}
                      {p.nextDueAt && ` · neste ${dato(p.nextDueAt)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
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
