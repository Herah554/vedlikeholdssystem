import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList, List, ShieldCheck, Wrench } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { lesMatrise } from "@/lib/rettigheter";
import { LISTER, hentListe, type Listeverdi } from "@/lib/lister";
import { lesFelter } from "@/lib/skjema";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { Aarsaker } from "./aarsaker";
import { Verdiliste } from "./lister";
import { Skjemamaler } from "./maler";
import { Maaling } from "./maaling";
import { RettighetsMatrise } from "./matrise";

export const metadata: Metadata = { title: "Oppsett" };

export default async function OppsettSide() {
  const { db, session } = await requireTenant();

  // Svarer «finnes ikke» framfor «ingen tilgang». Hvordan firmaet har fordelt
  // rettigheter er ikke noe alle ansatte trenger å vite finnes.
  if (session.role !== "ADMIN") notFound();

  const [org, aarsaker, maler, ...lister] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { permissions: true, personMaling: true },
    }),
    db.failureCause.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
      },
    }),
    db.formTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { _count: { select: { responses: true } } },
    }),
    ...LISTER.map((l) => hentListe(db, l.id)),
  ]);

  return (
    <>
      <PageHeader
        title="Oppsett"
        description="Hvordan systemet skal fungere hos dere. Bare administratorer ser denne siden."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-tekst-svak" aria-hidden />
                Hvem får gjøre hva
              </span>
            }
            description="Nivåene bygger på hverandre: den som kan administrere, kan også endre og se. Administrator har alltid alt, og står derfor ikke i tabellen."
          />
          <CardBody>
            <RettighetsMatrise matrise={lesMatrise(org.permissions)} />
          </CardBody>
        </Card>

        <Maaling naavaerende={org.personMaling} />

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="size-4 text-tekst-svak" aria-hidden />
                Skjemaer
              </span>
            }
            description="SJA, sjekklister og andre dokumenter som fylles ut per jobb. Endrer du en mal, står skjemaer som allerede er fylt ut urørt."
          />
          <CardBody>
            <Skjemamaler
              maler={maler.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                scope: m.scope,
                version: m.version,
                isActive: m.isActive,
                felter: lesFelter(m.fields),
                antallBrukt: m._count.responses,
              }))}
            />
          </CardBody>
        </Card>

        {LISTER.map((l, i) => (
          <Card key={l.id}>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <List className="size-4 text-tekst-svak" aria-hidden />
                  {l.navn}
                </span>
              }
              description={l.beskrivelse}
            />
            <CardBody>
              <Verdiliste
                liste={l.id}
                verdier={(lister[i] ?? []) as Listeverdi[]}
              />
            </CardBody>
          </Card>
        ))}

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Wrench className="size-4 text-tekst-svak" aria-hidden />
                Årsaker til feil
              </span>
            }
            description="Det teknikeren velger mellom når en jobb skal forklares. Gode årsaker gjør rapportene brukbare — og hjelper assistenten å finne igjen liknende feil."
          />
          <CardBody>
            <Aarsaker aarsaker={aarsaker} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
