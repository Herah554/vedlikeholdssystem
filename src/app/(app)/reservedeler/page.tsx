import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, Plus } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { kroner, tall, toNumber } from "@/lib/format";
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

export const metadata: Metadata = { title: "Reservedeler" };

export default async function ReservedelerSide(props: PageProps<"/reservedeler">) {
  const { db } = await requireTenant();
  const sp = await props.searchParams;
  const kunLave = sp.filter === "lav";
  const sok = typeof sp.sok === "string" ? sp.sok.trim() : "";

  const alle = await db.part.findMany({
    where: {
      isActive: true,
      ...(sok
        ? {
            OR: [
              { name: { contains: sok, mode: "insensitive" } },
              { number: { contains: sok, mode: "insensitive" } },
              { manufacturerPartNo: { contains: sok, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { number: "asc" },
  });

  const lave = alle.filter((d) => d.quantityOnHand < d.minStock);
  const deler = kunLave ? lave : alle;

  const lagerverdi = alle.reduce(
    (s, d) => s + d.quantityOnHand * toNumber(d.unitCost),
    0,
  );

  return (
    <>
      <PageHeader
        title="Reservedeler"
        description="Lagerbeholdning, minimumsnivå og forbruk"
        action={
          <ButtonLink href="/reservedeler/ny">
            <Plus className="size-4" aria-hidden />
            Ny reservedel
          </ButtonLink>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Antall delenumre" value={alle.length} />
        <StatCard
          label="Under minimum"
          value={lave.length}
          tone={lave.length ? "advarsel" : "god"}
          sub={lave.length ? "Bør bestilles" : "Alt på plass"}
          href={lave.length ? "/reservedeler?filter=lav" : undefined}
        />
        <StatCard label="Lagerverdi" value={kroner(lagerverdi)} />
        <StatCard
          label="Tomt på lager"
          value={alle.filter((d) => d.quantityOnHand <= 0).length}
          tone={alle.some((d) => d.quantityOnHand <= 0) ? "kritisk" : "god"}
        />
      </div>

      {kunLave && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Viser bare deler under minimumsnivå.
          <Link href="/reservedeler" className="font-medium underline">
            Vis alle
          </Link>
        </div>
      )}

      <Card>
        {deler.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-10" />}
            title={kunLave ? "Ingen deler under minimum" : "Ingen reservedeler"}
            description={
              kunLave
                ? "Lageret er innenfor de nivåene dere har satt."
                : "Legg inn delene dere bruker oftest, så slipper teknikerne å lete."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-32">Delenummer</Th>
                <Th>Navn</Th>
                <Th className="hidden lg:table-cell">Leverandør</Th>
                <Th className="hidden sm:table-cell">Hylle</Th>
                <Th className="text-right">Beholdning</Th>
                <Th className="hidden text-right md:table-cell">Minimum</Th>
                <Th className="hidden text-right md:table-cell">Pris</Th>
              </tr>
            </thead>
            <tbody>
              {deler.map((d) => {
                const lav = d.quantityOnHand < d.minStock;
                const tom = d.quantityOnHand <= 0;
                return (
                  <Tr key={d.id}>
                    <Td className="font-mono text-xs text-slate-500">
                      <Link href={`/reservedeler/${d.id}`} className="hover:text-merke-600">
                        {d.number}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/reservedeler/${d.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-merke-600"
                      >
                        {d.name}
                      </Link>
                      {d.manufacturer && (
                        <p className="text-xs text-slate-500">
                          {d.manufacturer}
                          {d.manufacturerPartNo && ` · ${d.manufacturerPartNo}`}
                        </p>
                      )}
                    </Td>
                    <Td className="hidden text-sm text-slate-600 lg:table-cell">
                      {d.supplier?.name ?? <span className="text-slate-400">–</span>}
                    </Td>
                    <Td className="hidden font-mono text-xs text-slate-500 sm:table-cell">
                      {d.binLocation ?? "–"}
                    </Td>
                    <Td className="text-right">
                      <Badge
                        className={
                          tom
                            ? "bg-red-100 text-red-800 ring-red-200"
                            : lav
                              ? "bg-amber-100 text-amber-900 ring-amber-200"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }
                      >
                        {tall(d.quantityOnHand)} {d.unit}
                      </Badge>
                    </Td>
                    <Td className="hidden text-right text-sm text-slate-500 tabular-nums md:table-cell">
                      {tall(d.minStock)}
                    </Td>
                    <Td className="hidden text-right text-sm tabular-nums md:table-cell">
                      {kroner(toNumber(d.unitCost))}
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
