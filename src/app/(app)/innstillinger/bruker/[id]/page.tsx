import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireTenant } from "@/lib/auth";
import { ROLLE } from "@/lib/domene";
import { datoTid, kroner, toNumber } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { nullstillPassord, oppdaterBruker } from "../../actions";
import { PassordSkjema, RedigerBrukerSkjema } from "./skjema";

export async function generateMetadata(
  props: PageProps<"/innstillinger/bruker/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { db } = await requireTenant();
  const b = await db.user.findFirst({ where: { id }, select: { name: true } });
  return { title: b ? b.name : "Bruker" };
}

export default async function BrukerSide(
  props: PageProps<"/innstillinger/bruker/[id]">,
) {
  const { id } = await props.params;
  const { db, session } = await requireTenant();

  // Bare administratorer skal kunne redigere andres kontoer
  if (!hasRole(session.role, "ADMIN")) redirect("/innstillinger");

  const bruker = await db.user.findFirst({
    where: { id },
    include: {
      organization: { select: { hourlyRate: true } },
      _count: { select: { assignedOrders: true, timeEntries: true } },
    },
  });

  if (!bruker) notFound();

  return (
    <>
      <Link
        href="/innstillinger"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-tekst-svak hover:text-tekst"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Innstillinger
      </Link>

      <PageHeader
        title={bruker.name}
        description={bruker.email}
        action={
          <div className="flex items-center gap-2">
            <Badge>{ROLLE[bruker.role]}</Badge>
            {!bruker.isActive && (
              <Badge className="bg-flate-dempet text-tekst-svak ring-kant">
                Deaktivert
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Opplysninger" />
            <CardBody>
              <RedigerBrukerSkjema
                lagre={oppdaterBruker.bind(null, bruker.id)}
                bruker={{
                  name: bruker.name,
                  email: bruker.email,
                  role: bruker.role,
                  phone: bruker.phone,
                  hourlyRate:
                    bruker.hourlyRate != null
                      ? String(toNumber(bruker.hourlyRate))
                      : null,
                  dailyHours: bruker.dailyHours,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Nullstill passord"
              description="Brukeren mister det gamle passordet med én gang"
            />
            <CardBody>
              <PassordSkjema
                nullstill={nullstillPassord.bind(null, bruker.id)}
                navn={bruker.name.split(" ")[0]}
              />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Aktivitet" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-tekst-svak">Tildelte arbeidsordre</dt>
                <dd className="font-medium text-tekst">
                  {bruker._count.assignedOrders}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tekst-svak">Timeføringer</dt>
                <dd className="font-medium text-tekst">{bruker._count.timeEntries}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tekst-svak">Sist innlogget</dt>
                <dd className="text-tekst">
                  {bruker.lastLoginAt ? datoTid(bruker.lastLoginAt) : "aldri"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tekst-svak">Opprettet</dt>
                <dd className="text-tekst">{datoTid(bruker.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-kant pt-3">
                <dt className="text-tekst-svak">Gjeldende timepris</dt>
                <dd className="font-medium text-tekst">
                  {kroner(
                    toNumber(bruker.hourlyRate ?? bruker.organization.hourlyRate),
                  )}
                  {bruker.hourlyRate == null && (
                    <span className="ml-1 text-xs text-tekst-svak">(firmaets)</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
