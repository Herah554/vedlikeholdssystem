import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  LogIn,
  Power,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { PLANER } from "@/lib/planer";
import { apneBedrift, settAktiv } from "./actions";
import { DemoKnapp } from "./demoknapp";
import { NyKundeSkjema } from "./skjema";

export const metadata: Metadata = { title: "Plattform" };

const dato = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" });

export default async function PlattformSide() {
  const session = await requireSuperadmin();

  // Direkte mot prisma, uten organisasjonsfilteret. Dette er det eneste
  // stedet i systemet som med hensikt ser på tvers av kunder, og
  // requireSuperadmin() over er sperren som holder alle andre ute.
  const bedrifter = await prisma.organization.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      orgNumber: true,
      isActive: true,
      plan: true,
      createdAt: true,
      _count: { select: { users: true, assets: true, workOrders: true } },
    },
  });

  const egen = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { organizationId: true },
  });

  const aktive = bedrifter.filter((b) => b.isActive).length;
  const brukere = bedrifter.reduce((n, b) => n + b._count.users, 0);
  const ordrer = bedrifter.reduce((n, b) => n + b._count.workOrders, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-tekst-svak">
          <ShieldCheck className="size-4 text-merke-600" aria-hidden />
          Plattformeier
        </span>
        <Link
          href="/dashbord"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-aksent hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Til systemet
        </Link>
      </div>

      <PageHeader
        title="Bedrifter"
        description="Alle kundene på denne serveren. Hver av dem ser bare sitt eget."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Aktive bedrifter" value={aktive} sub={`${bedrifter.length} totalt`} />
        <StatCard label="Brukere" value={brukere} />
        <StatCard label="Arbeidsordre" value={ordrer} />
      </div>

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>Bedrift</Th>
                <Th>Plan</Th>
                <Th>Brukere</Th>
                <Th>Utstyr</Th>
                <Th>Ordre</Th>
                <Th>Opprettet</Th>
                <Th>
                  <span className="sr-only">Handlinger</span>
                </Th>
              </Tr>
            </thead>
            <tbody>
              {bedrifter.map((b) => (
                <Tr key={b.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/plattform/${b.id}`}
                        className="font-medium text-tekst hover:text-aksent hover:underline"
                      >
                        {b.name}
                      </Link>
                      {b.id === egen.organizationId && (
                        <Badge className="bg-merke-50 text-merke-700 ring-merke-200 dark:bg-merke-500/15 dark:text-merke-300 dark:ring-merke-500/30">
                          ditt
                        </Badge>
                      )}
                      {!b.isActive && (
                        <Badge className="bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">
                          deaktivert
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-tekst-svak">
                      {b.orgNumber ? `Org.nr. ${b.orgNumber}` : b.slug}
                    </p>
                  </Td>
                  <Td>
                    <Link
                      href={`/plattform/${b.id}`}
                      className="inline-block rounded-full bg-flate-dempet px-2 py-0.5 text-xs font-medium text-tekst ring-1 ring-kant ring-inset hover:bg-flate-hover"
                    >
                      {PLANER[b.plan].navn}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{b._count.users}</Td>
                  <Td className="tabular-nums">{b._count.assets}</Td>
                  <Td className="tabular-nums">{b._count.workOrders}</Td>
                  <Td className="whitespace-nowrap text-tekst-svak">
                    {dato.format(b.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {b.isActive && (
                        <form action={apneBedrift}>
                          <input type="hidden" name="id" value={b.id} />
                          <Button variant="sekundær" type="submit">
                            <LogIn className="size-4" aria-hidden />
                            Åpne
                          </Button>
                        </form>
                      )}
                      {b.id !== egen.organizationId && (
                        <form action={settAktiv}>
                          <input type="hidden" name="id" value={b.id} />
                          <input
                            type="hidden"
                            name="aktiv"
                            value={b.isActive ? "nei" : "ja"}
                          />
                          <Button
                            variant={b.isActive ? "stille" : "sekundær"}
                            type="submit"
                            title={
                              b.isActive
                                ? "Steng tilgangen. Ingenting slettes."
                                : "Slå på tilgangen igjen"
                            }
                          >
                            <Power className="size-4" aria-hidden />
                            {b.isActive ? "Deaktiver" : "Aktiver"}
                          </Button>
                        </form>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-tekst-svak" aria-hidden />
              Ny kunde
            </span>
          }
          description="Bedriften får sitt eget adskilte område og én administrator som kan opprette resten selv."
        />
        <CardBody>
          <NyKundeSkjema />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-tekst-svak" aria-hidden />
              Demobedrift
            </span>
          }
          description="En ferdig utfylt bedrift å vise fram systemet med."
        />
        <CardBody>
          <DemoKnapp />
        </CardBody>
      </Card>
    </main>
  );
}
