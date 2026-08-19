import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { STANDARD_OPPSETT } from "@/components/widget-katalog";
import { hentOppsett } from "../oppsett";
import { deltMedMeg, delingsStatus } from "./deling";
import { DelKort, MottattKort } from "./delingskort";
import { Maler } from "./maler";
import { Velger } from "./velger";

export const metadata: Metadata = { title: "Tilpass dashbord" };

export default async function TilpassSide() {
  const { db, session } = await requireTenant();
  const [oppsett, deling, delte] = await Promise.all([
    hentOppsett(db, session.userId).then((o) => o ?? STANDARD_OPPSETT),
    delingsStatus(db, session.userId),
    deltMedMeg(db, session.userId),
  ]);

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

      <div className="mb-5">
        <Maler />
      </div>

      <Velger start={oppsett} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DelKort
          kolleger={deling.kolleger}
          heleFirmaet={deling.heleFirmaet}
          harEget={deling.harEget}
        />
        <MottattKort delte={delte} />
      </div>
    </>
  );
}
