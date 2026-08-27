import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { kanSession, requireModul } from "@/lib/auth";
import { grupperBehov } from "@/lib/delebehov";
import { ordreNummer, toNumber } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui";
import { BehovsPanel, type BehovRad } from "./panel";

export const metadata: Metadata = { title: "Delebehov" };

/**
 * Alt teknikerne mangler, samlet for den som bestiller.
 *
 * Grupperingen per leverandør gjøres i src/lib/delebehov.ts, ikke her, slik
 * at den kan kjøres i en test uten database og nettleser. Denne sida henter
 * dataene og viser dem fram.
 */
export default async function BehovSide() {
  const { db, session } = await requireModul("bestillinger");

  const rader = await db.partRequest.findMany({
    where: { status: "ONSKET" },
    include: {
      part: {
        select: {
          id: true,
          number: true,
          name: true,
          unit: true,
          quantityOnHand: true,
          unitCost: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
      },
      requestedBy: { select: { name: true } },
      workOrder: { select: { id: true, number: true, title: true } },
    },
    orderBy: [{ urgent: "desc" }, { createdAt: "asc" }],
    take: 300,
  });

  // Klienten får ferdige, enkle verdier. Decimal og Date krysser ikke
  // server/klient-grensen uten å bli til noe annet enn de var.
  const forGruppering = rader.map((r) => ({
    id: r.id,
    quantity: r.quantity,
    urgent: r.urgent,
    part: r.part
      ? {
          id: r.part.id,
          supplierId: r.part.supplierId,
          supplierNavn: r.part.supplier?.name ?? null,
          unitCost: toNumber(r.part.unitCost),
        }
      : null,
    rad: {
      id: r.id,
      quantity: r.quantity,
      urgent: r.urgent,
      note: r.note,
      description: r.description,
      meldtAv: r.requestedBy.name,
      meldt: r.createdAt.toISOString(),
      del: r.part
        ? {
            id: r.part.id,
            nummer: r.part.number,
            navn: r.part.name,
            enhet: r.part.unit,
            beholdning: r.part.quantityOnHand,
            pris: toNumber(r.part.unitCost),
          }
        : null,
      ordre: r.workOrder
        ? {
            id: r.workOrder.id,
            nummer: ordreNummer(r.workOrder.number),
            tittel: r.workOrder.title,
          }
        : null,
    } satisfies BehovRad,
  }));

  const { klare, utenLeverandor, maaKobles } = grupperBehov(forGruppering);

  const haster = rader.filter((r) => r.urgent).length;
  const klareAntall = klare.reduce((s, g) => s + g.behov.length, 0);

  return (
    <>
      <Link
        href="/bestillinger"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle bestillinger
      </Link>

      <PageHeader
        title="Delebehov"
        description="Deler teknikerne har meldt at de mangler, samlet per leverandør"
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Venter" value={rader.length} />
        <StatCard
          label="Haster"
          value={haster}
          sub={haster ? "Produksjonen står" : undefined}
          tone={haster ? "advarsel" : "nøytral"}
        />
        <StatCard label="Klare til bestilling" value={klareAntall} />
        <StatCard
          label="Trenger opprydning"
          value={utenLeverandor.length + maaKobles.length}
          sub="Mangler del eller leverandør"
          tone={utenLeverandor.length + maaKobles.length ? "advarsel" : "nøytral"}
        />
      </div>

      <BehovsPanel
        klare={klare.map((g) => ({
          supplierId: g.supplierId,
          navn: g.navn,
          behov: g.behov.map((b) => b.rad),
        }))}
        utenLeverandor={utenLeverandor.map((b) => b.rad)}
        maaKobles={maaKobles.map((b) => b.rad)}
        kanKoble={kanSession(session, "reservedeler", "administrere")}
        kanBestille={kanSession(session, "bestillinger", "administrere")}
      />
    </>
  );
}
