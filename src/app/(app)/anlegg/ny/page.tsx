import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { ANLEGG_TYPE } from "@/lib/domene";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { NyttUtstyrSkjema } from "./skjema";

export const metadata: Metadata = { title: "Nytt utstyr" };

export default async function NyttUtstyrSide(props: PageProps<"/anlegg/ny">) {
  const { db } = await requireTenant();
  const sp = await props.searchParams;

  const [foreldre, kostnadssteder] = await Promise.all([
    db.asset.findMany({
      where: { type: { in: ["ANLEGG", "SYSTEM", "UTSTYR"] } },
      select: { id: true, code: true, name: true, type: true, depth: true },
      orderBy: { path: "asc" },
    }),
    db.costCenter.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <Link
        href="/anlegg"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Anleggsstruktur
      </Link>

      <PageHeader
        title="Nytt utstyr"
        description="Legg inn et anlegg, et system eller en maskin"
      />

      <Card className="max-w-2xl">
        <CardBody>
          <NyttUtstyrSkjema
            foreldre={foreldre.map((f) => ({
              id: f.id,
              etikett: `${"  ".repeat(f.depth)}${f.code} — ${f.name} (${ANLEGG_TYPE[f.type]})`,
            }))}
            kostnadssteder={kostnadssteder.map((k) => ({
              id: k.id,
              etikett: `${k.code} — ${k.name}`,
            }))}
            forvalgtForelder={typeof sp.forelder === "string" ? sp.forelder : undefined}
          />
        </CardBody>
      </Card>
    </>
  );
}
