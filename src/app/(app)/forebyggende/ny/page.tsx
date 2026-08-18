import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { NyPlanSkjema } from "./skjema";

export const metadata: Metadata = { title: "Ny forebyggende plan" };

export default async function NyPlanSide(props: PageProps<"/forebyggende/ny">) {
  const { db } = await requireTenant();
  const sp = await props.searchParams;

  const [utstyr, brukere] = await Promise.all([
    db.asset.findMany({
      where: { type: { in: ["UTSTYR", "KOMPONENT", "SYSTEM"] }, status: { not: "UTRANGERT" } },
      select: { id: true, code: true, name: true },
      orderBy: { path: "asc" },
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
        href="/forebyggende"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Forebyggende vedlikehold
      </Link>

      <PageHeader
        title="Ny forebyggende plan"
        description="Sett opp en rutine som lager arbeidsordre av seg selv"
      />

      <Card className="max-w-2xl">
        <CardBody>
          <NyPlanSkjema
            utstyr={utstyr.map((u) => ({ id: u.id, etikett: `${u.code} — ${u.name}` }))}
            brukere={brukere}
            forvalgtUtstyr={typeof sp.utstyr === "string" ? sp.utstyr : undefined}
          />
        </CardBody>
      </Card>
    </>
  );
}
