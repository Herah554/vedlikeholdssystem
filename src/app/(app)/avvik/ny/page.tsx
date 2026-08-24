import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { kanSession, requireModul } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { AvviksSkjema } from "./skjema";

export const metadata: Metadata = { title: "Meld avvik" };

/** Lokal tid på formatet datetime-local vil ha. */
function naaLokalt(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function NyttAvvikSide() {
  const { db, session } = await requireModul("avvik");
  if (!kanSession(session, "avvik", "endre")) notFound();

  const utstyr = await db.asset.findMany({
    where: { type: { in: ["UTSTYR", "KOMPONENT"] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
    take: 500,
  });

  return (
    <>
      <Link
        href="/avvik"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tilbake til avvik
      </Link>

      <PageHeader
        title="Meld avvik"
        description="Noe som gikk galt, eller nesten gikk galt."
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 ring-inset dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Meld heller én gang for mye</p>
          <p className="mt-0.5">
            En nestenulykke er verdt å skrive ned selv om ingenting skjedde. Det
            er nettopp de som forteller hva som kan gå galt neste gang. Bilder
            legger du til etterpå.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <AvviksSkjema utstyr={utstyr} naa={naaLokalt()} />
        </CardBody>
      </Card>
    </>
  );
}
