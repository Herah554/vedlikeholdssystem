import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { APNE_STATUSER } from "@/lib/domene";
import { ukeNummer } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { Tavle, type Dag, type Jobb } from "./tavle";

export const metadata: Metadata = { title: "Ukeplan" };

/** Mandag i uka som ligger `forskyvning` uker fra denne uka. */
function mandagIUke(forskyvning: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay() gir 0 for søndag, så søndag må trekkes tilbake seks dager
  const tilMandag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - tilMandag + forskyvning * 7);
  return d;
}

export default async function UkeplanSide(props: PageProps<"/ukeplan">) {
  const { db } = await requireTenant();
  const sp = await props.searchParams;

  const forskyvning = Number(sp.uke ?? 0);
  const start = mandagIUke(Number.isFinite(forskyvning) ? forskyvning : 0);
  const slutt = new Date(start);
  slutt.setDate(slutt.getDate() + 7);

  const iDagIso = new Date().toISOString().slice(0, 10);

  const [iUka, uplanlagte] = await Promise.all([
    db.workOrder.findMany({
      where: {
        status: { in: APNE_STATUSER },
        plannedDate: { gte: start, lt: slutt },
      },
      include: {
        asset: { select: { code: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ priority: "asc" }, { number: "asc" }],
    }),
    db.workOrder.findMany({
      where: { status: { in: APNE_STATUSER }, plannedDate: null },
      include: {
        asset: { select: { code: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 40,
    }),
  ]);

  type Rad = (typeof iUka)[number];
  const tilJobb = (o: Rad): Jobb => ({
    id: o.id,
    number: o.number,
    title: o.title,
    priority: o.priority,
    type: o.type,
    estimatedHours: o.estimatedHours,
    assetCode: o.asset?.code ?? null,
    assignedTo: o.assignedTo?.name ?? null,
  });

  const ukedagsnavn = new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const dager: Dag[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    // Lokal ISO-dato, ikke UTC — ellers havner jobber på feil dag om natta
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    return {
      iso,
      navn: ukedagsnavn.format(d),
      erIDag: iso === iDagIso,
      jobber: iUka
        .filter((o) => {
          const p = o.plannedDate!;
          return (
            `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}-${String(p.getDate()).padStart(2, "0")}` ===
            iso
          );
        })
        .map(tilJobb),
    };
  });

  const uke = ukeNummer(start);
  const lenke = (n: number) => (n === 0 ? "/ukeplan" : `/ukeplan?uke=${n}`);

  return (
    <>
      <PageHeader
        title={`Uke ${uke}`}
        description="Dra jobbene dit de hører hjemme. Endringen lagres med én gang."
        action={
          <div className="flex items-center gap-1">
            <Link
              href={lenke(forskyvning - 1)}
              className="rounded-lg p-2 text-tekst-svak hover:bg-flate-dempet"
              aria-label="Forrige uke"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link
              href="/ukeplan"
              className="rounded-lg px-3 py-2 text-sm font-medium text-tekst hover:bg-flate-dempet"
            >
              Denne uka
            </Link>
            <Link
              href={lenke(forskyvning + 1)}
              className="rounded-lg p-2 text-tekst-svak hover:bg-flate-dempet"
              aria-label="Neste uke"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />

      <Tavle dager={dager} uplanlagte={uplanlagte.map(tilJobb)} />
    </>
  );
}
