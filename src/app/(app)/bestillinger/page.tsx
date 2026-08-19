import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, ShoppingCart, Truck } from "lucide-react";
import { requireModul } from "@/lib/auth";
import { bestillingsNummer } from "@/lib/epost";
import { APNE_BESTILLINGER, BESTILLING_STATUS } from "@/lib/domene";
import { dato, kroner, toNumber } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const metadata: Metadata = { title: "Bestillinger" };

export default async function BestillingerSide(props: PageProps<"/bestillinger">) {
  const { db } = await requireModul("bestillinger");
  const sp = await props.searchParams;
  const kunApne = sp.apne === "1";

  const bestillinger = await db.purchaseOrder.findMany({
    where: kunApne ? { status: { in: APNE_BESTILLINGER } } : undefined,
    include: {
      supplier: { select: { name: true, email: true } },
      lines: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const alle = await db.purchaseOrder.findMany({
    select: { status: true, lines: { select: { quantity: true, unitCost: true } } },
  });

  const utkast = alle.filter((b) => b.status === "UTKAST").length;
  const venter = alle.filter(
    (b) => b.status === "SENDT" || b.status === "DELVIS_MOTTATT",
  ).length;
  const utestaaendeVerdi = alle
    .filter((b) => b.status === "SENDT" || b.status === "DELVIS_MOTTATT")
    .reduce(
      (s, b) =>
        s + b.lines.reduce((t, l) => t + l.quantity * toNumber(l.unitCost), 0),
      0,
    );

  return (
    <>
      <PageHeader
        title="Bestillinger"
        description="Deler bestilt fra leverandør, samlet per leverandør"
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/leverandorer" variant="sekundær">
              <Truck className="size-4" aria-hidden />
              Leverandører
            </ButtonLink>
            <ButtonLink href="/reservedeler?filter=lav">
              <Boxes className="size-4" aria-hidden />
              Bestill fra lageret
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utkast" value={utkast} sub="Ikke sendt ennå" tone={utkast ? "advarsel" : "nøytral"} />
        <StatCard label="Venter på levering" value={venter} />
        <StatCard label="Verdi utestående" value={kroner(utestaaendeVerdi)} />
        <StatCard label="Totalt" value={alle.length} />
      </div>

      <div className="mb-4">
        <Link
          href={kunApne ? "/bestillinger" : "/bestillinger?apne=1"}
          className="text-sm text-aksent hover:underline"
        >
          {kunApne ? "Vis alle bestillinger" : "Vis bare de som ikke er ferdige"}
        </Link>
      </div>

      <Card>
        {bestillinger.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="size-10" />}
            title="Ingen bestillinger"
            description="Gå til reservedelene, huk av delene som må bestilles, og la systemet samle dem per leverandør."
            action={
              <ButtonLink href="/reservedeler?filter=lav">
                <Boxes className="size-4" aria-hidden />
                Se deler under minimum
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-24">Nummer</Th>
                <Th>Leverandør</Th>
                <Th>Status</Th>
                <Th className="hidden text-right sm:table-cell">Linjer</Th>
                <Th className="text-right">Sum</Th>
                <Th className="hidden lg:table-cell">Opprettet</Th>
              </tr>
            </thead>
            <tbody>
              {bestillinger.map((b) => {
                const sum = b.lines.reduce(
                  (s, l) => s + l.quantity * toNumber(l.unitCost),
                  0,
                );
                return (
                  <Tr key={b.id}>
                    <Td className="font-mono text-xs text-tekst-svak">
                      <Link href={`/bestillinger/${b.id}`} className="hover:text-aksent">
                        {bestillingsNummer(b.number)}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/bestillinger/${b.id}`}
                        className="text-sm font-medium text-tekst hover:text-aksent"
                      >
                        {b.supplier.name}
                      </Link>
                      {!b.supplier.email && (
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                          mangler e-post
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge className={BESTILLING_STATUS[b.status].klasse}>
                        {BESTILLING_STATUS[b.status].tekst}
                      </Badge>
                    </Td>
                    <Td className="hidden text-right text-sm text-tekst-svak tabular-nums sm:table-cell">
                      {b.lines.length}
                    </Td>
                    <Td className="text-right text-sm font-medium tabular-nums">
                      {kroner(sum)}
                    </Td>
                    <Td className="hidden text-sm whitespace-nowrap text-tekst-svak lg:table-cell">
                      {dato(b.createdAt)}
                      <div className="text-xs">{b.createdBy.name}</div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
