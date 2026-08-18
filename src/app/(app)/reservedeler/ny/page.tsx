import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { NyDelSkjema } from "./skjema";

export const metadata: Metadata = { title: "Ny reservedel" };

export default async function NyDelSide() {
  const { db } = await requireTenant();
  const leverandorer = await db.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <Link
        href="/reservedeler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle reservedeler
      </Link>

      <PageHeader title="Ny reservedel" description="Legg delen inn i lageret" />

      <Card className="max-w-2xl">
        <CardBody>
          <NyDelSkjema leverandorer={leverandorer.map((l) => ({ id: l.id, navn: l.name }))} />
        </CardBody>
      </Card>
    </>
  );
}
