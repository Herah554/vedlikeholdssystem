import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireTenant } from "@/lib/auth";
import { bestillingsNummer } from "@/lib/epost";
import { BESTILLING_STATUS } from "@/lib/domene";
import { dato, kroner, tall, toNumber } from "@/lib/format";
import {
  Badge,
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
import { oppdaterLeverandor } from "../actions";
import { RedigerLeverandorSkjema } from "../skjema";

export async function generateMetadata(
  props: PageProps<"/leverandorer/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const l = await db.supplier.findFirst({ where: { id }, select: { name: true } });
  return { title: l ? l.name : "Leverandør" };
}

export default async function LeverandorSide(
  props: PageProps<"/leverandorer/[id]">,
) {
  const { id } = await props.params;
  const { db, session } = await requireTenant();

  if (!hasRole(session.role, "PLANLEGGER")) redirect("/leverandorer");

  const leverandor = await db.supplier.findFirst({
    where: { id },
    include: {
      parts: {
        select: {
          id: true,
          number: true,
          name: true,
          unit: true,
          quantityOnHand: true,
          minStock: true,
        },
        orderBy: { number: "asc" },
      },
      purchaseOrders: {
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  });

  if (!leverandor) notFound();

  return (
    <>
      <Link
        href="/leverandorer"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle leverandører
      </Link>

      <PageHeader
        title={leverandor.name}
        description={leverandor.contactName ?? undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Bestillinger"
              description={`${leverandor.purchaseOrders.length} siste`}
            />
            {leverandor.purchaseOrders.length === 0 ? (
              <EmptyState title="Ingen bestillinger ennå" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Nummer</Th>
                    <Th>Status</Th>
                    <Th className="hidden sm:table-cell">Opprettet</Th>
                    <Th className="text-right">Linjer</Th>
                    <Th className="text-right">Sum</Th>
                  </tr>
                </thead>
                <tbody>
                  {leverandor.purchaseOrders.map((b) => {
                    const sum = b.lines.reduce(
                      (s, l) => s + l.quantity * toNumber(l.unitCost),
                      0,
                    );
                    return (
                      <Tr key={b.id}>
                        <Td className="font-mono text-xs text-tekst-svak">
                          <Link
                            href={`/bestillinger/${b.id}`}
                            className="hover:text-aksent"
                          >
                            {bestillingsNummer(b.number)}
                          </Link>
                        </Td>
                        <Td>
                          <Badge className={BESTILLING_STATUS[b.status].klasse}>
                            {BESTILLING_STATUS[b.status].tekst}
                          </Badge>
                        </Td>
                        <Td className="hidden text-sm text-tekst-svak sm:table-cell">
                          {dato(b.createdAt)}
                        </Td>
                        <Td className="text-right text-sm tabular-nums">
                          {b.lines.length}
                        </Td>
                        <Td className="text-right text-sm tabular-nums">
                          {kroner(sum)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Deler fra denne leverandøren"
              description={`${leverandor.parts.length} delenumre`}
            />
            {leverandor.parts.length === 0 ? (
              <EmptyState title="Ingen deler koblet" description="Velg leverandør på reservedelen for å koble dem sammen." />
            ) : (
              <Table>
                <tbody>
                  {leverandor.parts.map((d) => (
                    <Tr key={d.id}>
                      <Td className="w-32 font-mono text-xs text-tekst-svak">
                        <Link href={`/reservedeler/${d.id}`} className="hover:text-aksent">
                          {d.number}
                        </Link>
                      </Td>
                      <Td className="text-sm text-tekst">{d.name}</Td>
                      <Td className="text-right">
                        <Badge
                          className={
                            d.quantityOnHand < d.minStock
                              ? "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                          }
                        >
                          {tall(d.quantityOnHand)} {d.unit}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Kontaktopplysninger" />
          <CardBody>
            <RedigerLeverandorSkjema
              lagre={oppdaterLeverandor.bind(null, leverandor.id)}
              verdier={{
                name: leverandor.name,
                contactName: leverandor.contactName,
                email: leverandor.email,
                phone: leverandor.phone,
                website: leverandor.website,
              }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
