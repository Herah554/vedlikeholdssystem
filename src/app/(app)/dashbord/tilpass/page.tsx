import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { STANDARD_OPPSETT } from "@/components/widget-katalog";
import { hentOppsett } from "../oppsett";
import { Velger } from "./velger";

export const metadata: Metadata = { title: "Tilpass dashbord" };

export default async function TilpassSide() {
  const { db, session } = await requireTenant();
  const oppsett = (await hentOppsett(db, session.userId)) ?? STANDARD_OPPSETT;

  return (
    <>
      <Link
        href="/dashbord"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tilbake til dashbordet
      </Link>

      <PageHeader
        title="Tilpass dashbord"
        description="Velg hvilke tall du vil se, og i hvilken rekkefølge. Oppsettet gjelder bare deg."
      />

      <Velger start={oppsett} />
    </>
  );
}
