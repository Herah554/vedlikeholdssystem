import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { kanSession, requireModul, requireTenant } from "@/lib/auth";
import { bestillingsNummer, harSmtp } from "@/lib/epost";
import { BESTILLING_STATUS } from "@/lib/domene";
import { dato, datoTid, kroner, tall, toNumber } from "@/lib/format";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { leggTilLinje, oppdaterBestilling } from "../actions";
import {
  DetaljerSkjema,
  KansellerKnapp,
  LeggTilLinjeSkjema,
  LinjeHandlinger,
  MottakSkjema,
  SendPanel,
  EndringsVarsel,
} from "./handlinger";

export async function generateMetadata(
  props: PageProps<"/bestillinger/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const b = await db.purchaseOrder.findFirst({
    where: { id },
    select: { number: true, supplier: { select: { name: true } } },
  });
  return {
    title: b ? `${bestillingsNummer(b.number)} ${b.supplier.name}` : "Bestilling",
  };
}

export default async function BestillingSide(props: PageProps<"/bestillinger/[id]">) {
  const { id } = await props.params;
  const { db, session } = await requireModul("bestillinger");

  const bestilling = await db.purchaseOrder.findFirst({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      lines: {
        include: {
          part: {
            select: {
              id: true,
              number: true,
              name: true,
              unit: true,
              manufacturer: true,
              manufacturerPartNo: true,
            },
          },
        },
      },
    },
  });

  if (!bestilling) notFound();

  const kanPlanlegge = kanSession(session, "bestillinger", "administrere");
  const laast =
    bestilling.status === "MOTTATT" || bestilling.status === "KANSELLERT";

  // Deler fra samme leverandør som ikke allerede står på bestillingen
  const paaBestillingen = new Set(bestilling.lines.map((l) => l.partId));
  const ledigeDeler = await db.part.findMany({
    where: { supplierId: bestilling.supplierId, isActive: true },
    select: { id: true, number: true, name: true, unit: true },
    orderBy: { number: "asc" },
  });

  const sum = bestilling.lines.reduce(
    (s, l) => s + l.quantity * toNumber(l.unitCost),
    0,
  );

  return (
    <>
      <Link
        href="/bestillinger"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle bestillinger
      </Link>

      <div className="mb-6">
        <p className="font-mono text-sm text-tekst-svak">
          {bestillingsNummer(bestilling.number)}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold text-tekst">
          {bestilling.supplier.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className={BESTILLING_STATUS[bestilling.status].klasse}>
            {BESTILLING_STATUS[bestilling.status].tekst}
          </Badge>
          <span className="text-xs text-tekst-svakest">
            opprettet av {bestilling.createdBy.name} {dato(bestilling.createdAt)}
          </span>
          {bestilling.sentAt && (
            <span className="text-xs text-tekst-svakest">
              · sendt {datoTid(bestilling.sentAt)}
              {bestilling.sentToEmail ? ` til ${bestilling.sentToEmail}` : ""}
              {bestilling.sentMethod === "manuell" ? " (manuelt)" : ""}
            </span>
          )}
        </div>
      </div>

      {bestilling.pendingChanges > 0 && (
        <EndringsVarsel
          bestillingId={bestilling.id}
          antall={bestilling.pendingChanges}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Bestillingslinjer"
              description={`${bestilling.lines.length} ${bestilling.lines.length === 1 ? "linje" : "linjer"} — ${kroner(sum)} eks. mva.`}
            />
            {bestilling.lines.length === 0 ? (
              <CardBody>
                <p className="text-sm text-tekst-svak">
                  Ingen linjer ennå. Legg til deler nedenfor.
                </p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Del</Th>
                    <Th className="hidden text-right sm:table-cell">Pris</Th>
                    <Th className="text-right">Antall</Th>
                    <Th className="text-right">Mottatt</Th>
                    <Th className="text-right">Sum</Th>
                  </tr>
                </thead>
                <tbody>
                  {bestilling.lines.map((l) => (
                    <Tr
                      key={l.id}
                      className={
                        l.addedLater
                          ? "bg-amber-50/70 dark:bg-amber-500/10"
                          : undefined
                      }
                    >
                      <Td>
                        <Link
                          href={`/reservedeler/${l.part.id}`}
                          className="text-sm font-medium text-tekst hover:text-aksent"
                        >
                          {l.part.name}
                        </Link>
                        {l.addedLater && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                            ny
                          </span>
                        )}
                        <p className="font-mono text-xs text-tekst-svak">
                          {l.part.number}
                          {l.part.manufacturerPartNo &&
                            ` · ${l.part.manufacturer ?? ""} ${l.part.manufacturerPartNo}`}
                        </p>
                      </Td>
                      <Td className="hidden text-right text-sm text-tekst-svak tabular-nums sm:table-cell">
                        {kroner(toNumber(l.unitCost))}
                      </Td>
                      <Td className="text-right">
                        {kanPlanlegge ? (
                          <LinjeHandlinger
                            bestillingId={bestilling.id}
                            linjeId={l.id}
                            antall={l.quantity}
                            laast={laast}
                          />
                        ) : (
                          <span className="text-sm tabular-nums">
                            {tall(l.quantity)}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        <span
                          className={
                            l.receivedQuantity >= l.quantity
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-tekst-svak"
                          }
                        >
                          {tall(l.receivedQuantity)} / {tall(l.quantity)}
                        </span>
                      </Td>
                      <Td className="text-right text-sm font-medium tabular-nums">
                        {kroner(l.quantity * toNumber(l.unitCost))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}

            {kanPlanlegge && !laast && (
              <CardBody className="border-t border-kant">
                <LeggTilLinjeSkjema
                  leggTil={leggTilLinje.bind(null, bestilling.id)}
                  deler={ledigeDeler.filter((d) => !paaBestillingen.has(d.id))}
                />
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Motta varer"
              description="Fører delene rett inn på lager"
            />
            <CardBody>
              {bestilling.status === "KANSELLERT" ? (
                <p className="text-sm text-tekst-svak">
                  Bestillingen er kansellert.
                </p>
              ) : (
                <MottakSkjema
                  bestillingId={bestilling.id}
                  linjer={bestilling.lines.map((l) => ({
                    id: l.id,
                    navn: l.part.name,
                    nummer: l.part.number,
                    enhet: l.part.unit,
                    bestilt: l.quantity,
                    mottatt: l.receivedQuantity,
                  }))}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {kanPlanlegge && !laast && bestilling.lines.length > 0 && (
            <Card>
              <CardHeader
                title="Send til leverandør"
                description={
                  harSmtp()
                    ? "Sendes direkte fra systemet"
                    : "Åpnes i din egen e-postklient"
                }
              />
              <CardBody>
                <SendPanel
                  bestillingId={bestilling.id}
                  harEpostadresse={Boolean(bestilling.supplier.email)}
                  erSendt={bestilling.status !== "UTKAST"}
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Leverandør" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div>
                  <dt className="text-tekst-svak">Firma</dt>
                  <dd>
                    <Link
                      href={`/leverandorer/${bestilling.supplier.id}`}
                      className="font-medium text-aksent hover:underline"
                    >
                      {bestilling.supplier.name}
                    </Link>
                  </dd>
                </div>
                {bestilling.supplier.contactName && (
                  <div>
                    <dt className="text-tekst-svak">Kontaktperson</dt>
                    <dd className="text-tekst">{bestilling.supplier.contactName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-tekst-svak">E-post</dt>
                  <dd>
                    {bestilling.supplier.email ? (
                      <a
                        href={`mailto:${bestilling.supplier.email}`}
                        className="inline-flex items-center gap-1.5 text-aksent hover:underline"
                      >
                        <Mail className="size-3.5" aria-hidden />
                        {bestilling.supplier.email}
                      </a>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        mangler — legg den inn på leverandøren
                      </span>
                    )}
                  </dd>
                </div>
                {bestilling.supplier.phone && (
                  <div>
                    <dt className="text-tekst-svak">Telefon</dt>
                    <dd className="inline-flex items-center gap-1.5 text-tekst">
                      <Phone className="size-3.5" aria-hidden />
                      {bestilling.supplier.phone}
                    </dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {kanPlanlegge && (
            <Card>
              <CardHeader title="Opplysninger" />
              <CardBody>
                {laast ? (
                  <dl className="space-y-2.5 text-sm">
                    <div>
                      <dt className="text-tekst-svak">Vår referanse</dt>
                      <dd className="text-tekst">{bestilling.reference ?? "–"}</dd>
                    </div>
                    <div>
                      <dt className="text-tekst-svak">Ønsket levering</dt>
                      <dd className="text-tekst">
                        {bestilling.expectedAt ? dato(bestilling.expectedAt) : "–"}
                      </dd>
                    </div>
                    {bestilling.note && (
                      <div>
                        <dt className="text-tekst-svak">Merknad</dt>
                        <dd className="whitespace-pre-wrap text-tekst">
                          {bestilling.note}
                        </dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <DetaljerSkjema
                    lagre={oppdaterBestilling.bind(null, bestilling.id)}
                    verdier={{
                      reference: bestilling.reference,
                      note: bestilling.note,
                      expectedAt: bestilling.expectedAt
                        ? bestilling.expectedAt.toISOString().slice(0, 10)
                        : null,
                    }}
                  />
                )}
              </CardBody>
            </Card>
          )}

          {kanPlanlegge && !laast && (
            <Card>
              <CardBody>
                <KansellerKnapp bestillingId={bestilling.id} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
