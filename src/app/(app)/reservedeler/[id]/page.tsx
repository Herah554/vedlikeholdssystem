import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { LAGER_BEVEGELSE } from "@/lib/domene";
import { datoTid, kroner, ordreNummer, tall, toNumber } from "@/lib/format";
import {
  Badge,
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
import { InnkjopSkjema, OpptellingSkjema } from "./skjemaer";
import { justerBeholdning, registrerInnkjop } from "../actions";

export async function generateMetadata(
  props: PageProps<"/reservedeler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const d = await db.part.findFirst({ where: { id }, select: { number: true, name: true } });
  return { title: d ? `${d.number} ${d.name}` : "Reservedel" };
}

export default async function DelSide(props: PageProps<"/reservedeler/[id]">) {
  const { id } = await props.params;
  const { db } = await requireTenant();

  const del = await db.part.findFirst({
    where: { id },
    include: {
      supplier: true,
      assets: {
        include: { asset: { select: { id: true, code: true, name: true } } },
      },
      movements: {
        include: {
          user: { select: { name: true } },
          workOrder: { select: { id: true, number: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      },
    },
  });

  if (!del) notFound();

  const forbruk = del.movements
    .filter((m) => m.type === "UT")
    .reduce((s, m) => s + Math.abs(m.quantity), 0);

  const lav = del.quantityOnHand < del.minStock;

  return (
    <>
      <Link
        href="/reservedeler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle reservedeler
      </Link>

      <div className="mb-6">
        <p className="font-mono text-sm text-slate-500">{del.number}</p>
        <h1 className="mt-0.5 text-xl font-semibold text-slate-900">{del.name}</h1>
        {del.manufacturer && (
          <p className="mt-1 text-sm text-slate-500">
            {del.manufacturer}
            {del.manufacturerPartNo && ` · ${del.manufacturerPartNo}`}
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="På lager"
          value={`${tall(del.quantityOnHand)} ${del.unit}`}
          tone={del.quantityOnHand <= 0 ? "kritisk" : lav ? "advarsel" : "god"}
          sub={lav ? `Under minimum på ${tall(del.minStock)}` : "Over minimumsnivå"}
        />
        <StatCard label="Enhetspris" value={kroner(toNumber(del.unitCost))} />
        <StatCard
          label="Lagerverdi"
          value={kroner(del.quantityOnHand * toNumber(del.unitCost))}
        />
        <StatCard
          label="Forbruk"
          value={`${tall(forbruk)} ${del.unit}`}
          sub="Siste bevegelser"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Lagerbevegelser"
              description="Alt inn og ut, med hvem og hvorfor"
            />
            {del.movements.length === 0 ? (
              <EmptyState title="Ingen bevegelser ennå" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Når</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Antall</Th>
                    <Th className="hidden sm:table-cell">Årsak</Th>
                  </tr>
                </thead>
                <tbody>
                  {del.movements.map((m) => (
                    <Tr key={m.id}>
                      <Td className="text-xs whitespace-nowrap text-slate-500">
                        {datoTid(m.createdAt)}
                        {m.user && <div className="text-slate-400">{m.user.name}</div>}
                      </Td>
                      <Td>
                        <Badge
                          className={
                            m.type === "INN"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : m.type === "UT"
                                ? "bg-sky-50 text-sky-700 ring-sky-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200"
                          }
                        >
                          {LAGER_BEVEGELSE[m.type]}
                        </Badge>
                      </Td>
                      <Td
                        className={`text-right text-sm font-medium tabular-nums ${
                          m.quantity < 0 ? "text-slate-600" : "text-emerald-700"
                        }`}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {tall(m.quantity)}
                      </Td>
                      <Td className="hidden text-sm text-slate-600 sm:table-cell">
                        {m.workOrder ? (
                          <Link
                            href={`/arbeidsordre/${m.workOrder.id}`}
                            className="text-merke-600 hover:text-merke-700"
                          >
                            {ordreNummer(m.workOrder.number)} {m.workOrder.title}
                          </Link>
                        ) : (
                          (m.note ?? <span className="text-slate-400">–</span>)
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Passer til"
              description="Utstyr denne delen er koblet mot"
            />
            {del.assets.length === 0 ? (
              <EmptyState
                title="Ikke koblet til utstyr"
                description="Kobler du delen til utstyret den sitter i, dukker den opp automatisk når noen jobber på maskinen."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {del.assets.map((ap) => (
                  <li key={ap.id}>
                    <Link
                      href={`/anlegg/${ap.asset.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <span className="font-mono text-xs text-slate-500">{ap.asset.code}</span>
                      <span className="flex-1 text-sm text-slate-900">{ap.asset.name}</span>
                      <span className="text-xs text-slate-500">
                        {tall(ap.quantity)} {del.unit} i bruk
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Opplysninger" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <Rad navn="Enhet">{del.unit}</Rad>
                <Rad navn="Minimum">{tall(del.minStock)}</Rad>
                <Rad navn="Maksimum">{del.maxStock ? tall(del.maxStock) : "–"}</Rad>
                <Rad navn="Hylle">{del.binLocation ?? "–"}</Rad>
                <Rad navn="Leverandør">{del.supplier?.name ?? "–"}</Rad>
                <Rad navn="Leveringstid">
                  {del.leadTimeDays ? `${del.leadTimeDays} dager` : "–"}
                </Rad>
              </dl>
              {del.description && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
                  {del.description}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Registrer mottak" description="Varer inn fra leverandør" />
            <CardBody>
              <InnkjopSkjema
                registrer={registrerInnkjop.bind(null, del.id)}
                enhet={del.unit}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Opptelling" description="Korriger etter fysisk telling" />
            <CardBody>
              <OpptellingSkjema
                juster={justerBeholdning.bind(null, del.id)}
                beholdning={del.quantityOnHand}
                enhet={del.unit}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Rad({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{navn}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
    </div>
  );
}
