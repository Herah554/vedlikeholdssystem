import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { ANLEGG_TYPE } from "@/lib/domene";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { NyOrdreSkjema } from "./skjema";

export const metadata: Metadata = { title: "Ny arbeidsordre" };

export default async function NyOrdreSide(props: PageProps<"/arbeidsordre/ny">) {
  const { db } = await requireTenant();
  const sp = await props.searchParams;

  const [utstyr, brukere] = await Promise.all([
    db.asset.findMany({
      where: { status: { not: "UTRANGERT" } },
      select: { id: true, code: true, name: true, type: true, depth: true },
      orderBy: [{ path: "asc" }],
    }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <Link
        href="/arbeidsordre"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle arbeidsordre
      </Link>

      <PageHeader
        title="Ny arbeidsordre"
        description="Meld inn en feil eller planlegg en jobb"
      />

      <Card className="max-w-2xl">
        <CardBody>
          <NyOrdreSkjema
            utstyr={utstyr.map((u) => ({
              id: u.id,
              // Innrykk i nedtrekkslista gjør anleggshierarkiet lesbart
              etikett: `${"  ".repeat(u.depth)}${u.code} — ${u.name} (${ANLEGG_TYPE[u.type]})`,
            }))}
            brukere={brukere}
            forvalgtUtstyr={typeof sp.utstyr === "string" ? sp.utstyr : undefined}
          />
        </CardBody>
      </Card>
    </>
  );
}
