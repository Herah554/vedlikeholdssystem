import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import { BUDSJETT_KATEGORI, ROLLE_BESKRIVELSE } from "@/lib/domene";
import { datoTid, kroner, toNumber } from "@/lib/format";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import {
  AktivBryter,
  NyBrukerSkjema,
  NyBudsjettSkjema,
  NyttKostnadsstedSkjema,
  OrganisasjonSkjema,
  RolleVelger,
} from "./skjemaer";

export const metadata: Metadata = { title: "Innstillinger" };

export default async function InnstillingerSide() {
  const { db, session } = await requireTenant();

  const erAdmin = hasRole(session.role, "ADMIN");
  const erLeder = hasRole(session.role, "LEDER");

  const [organisasjon, brukere, kostnadssteder, budsjetter] = await Promise.all([
    db.user.findFirst({
      where: { id: session.userId },
      select: { organization: true },
    }),
    db.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.costCenter.findMany({ orderBy: { code: "asc" } }),
    db.budget.findMany({
      include: { costCenter: { select: { code: true, name: true } } },
      orderBy: [{ year: "desc" }, { name: "asc" }],
      take: 30,
    }),
  ]);

  const org = organisasjon?.organization;

  return (
    <>
      <PageHeader
        title="Innstillinger"
        description="Organisasjon, brukere og økonomioppsett"
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Organisasjon"
            description={
              erAdmin
                ? "Opplysningene brukes som avsender på bestillinger til leverandør"
                : ROLLE_BESKRIVELSE[session.role]
            }
          />
          <CardBody>
            {erAdmin && org ? (
              <OrganisasjonSkjema
                organisasjon={{
                  name: org.name,
                  orgNumber: org.orgNumber,
                  hourlyRate: String(toNumber(org.hourlyRate)),
                  email: org.email,
                  phone: org.phone,
                  address: org.address,
                  postalCode: org.postalCode,
                  city: org.city,
                }}
              />
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-tekst-svak">Navn</dt>
                  <dd className="font-medium text-tekst">{org?.name}</dd>
                </div>
                <div>
                  <dt className="text-tekst-svak">Organisasjonsnummer</dt>
                  <dd className="font-medium text-tekst">{org?.orgNumber ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-tekst-svak">Standard timepris</dt>
                  <dd className="font-medium text-tekst">
                    {org ? kroner(toNumber(org.hourlyRate)) : "–"}
                  </dd>
                </div>
                <div>
                  <dt className="text-tekst-svak">Din rolle</dt>
                  <dd className="font-medium text-tekst">
                    {ROLLE_BESKRIVELSE[session.role]}
                  </dd>
                </div>
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Brukere"
            description={`${brukere.filter((b) => b.isActive).length} aktive av ${brukere.length}`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Navn</Th>
                <Th className="hidden sm:table-cell">E-post</Th>
                <Th>Rolle</Th>
                <Th className="hidden lg:table-cell">Sist innlogget</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {brukere.map((b) => (
                <Tr key={b.id} className={b.isActive ? undefined : "opacity-50"}>
                  <Td>
                    {erAdmin ? (
                      <Link
                        href={`/innstillinger/bruker/${b.id}`}
                        className="text-sm font-medium text-tekst hover:text-aksent"
                      >
                        {b.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-tekst">{b.name}</span>
                    )}
                    {b.id === session.userId && (
                      <span className="ml-1.5 text-xs text-tekst-svakest">(deg)</span>
                    )}
                    <div className="text-xs text-tekst-svak sm:hidden">{b.email}</div>
                  </Td>
                  <Td className="hidden text-sm text-tekst-svak sm:table-cell">{b.email}</Td>
                  <Td>
                    <RolleVelger brukerId={b.id} rolle={b.role} kanEndre={erAdmin} />
                  </Td>
                  <Td className="hidden text-sm whitespace-nowrap text-tekst-svak lg:table-cell">
                    {b.lastLoginAt ? datoTid(b.lastLoginAt) : "aldri"}
                  </Td>
                  <Td>
                    <AktivBryter brukerId={b.id} aktiv={b.isActive} kanEndre={erAdmin} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {erAdmin && (
          <Card>
            <CardHeader
              title="Legg til bruker"
              description="Den nye brukeren får tilgang til denne organisasjonen — og ingen andre"
            />
            <CardBody>
              <NyBrukerSkjema />
            </CardBody>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Kostnadssteder"
              description="Bestemmer hvilket budsjett kostnadene havner på"
            />
            {kostnadssteder.length === 0 ? (
              <EmptyState title="Ingen kostnadssteder" />
            ) : (
              <Table>
                <tbody>
                  {kostnadssteder.map((k) => (
                    <Tr key={k.id}>
                      <Td className="w-20 font-mono text-xs text-tekst-svak">{k.code}</Td>
                      <Td className="text-sm text-tekst">{k.name}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {erLeder && (
              <CardBody className="border-t border-kant">
                <NyttKostnadsstedSkjema />
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Budsjettlinjer" description="Siste 30" />
            {budsjetter.length === 0 ? (
              <EmptyState title="Ingen budsjetter lagt inn" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Navn</Th>
                    <Th className="hidden sm:table-cell">År</Th>
                    <Th className="text-right">Beløp</Th>
                  </tr>
                </thead>
                <tbody>
                  {budsjetter.map((b) => (
                    <Tr key={b.id}>
                      <Td>
                        <span className="text-sm text-tekst">{b.name}</span>
                        <div className="text-xs text-tekst-svak">
                          {b.costCenter ? `${b.costCenter.code} ` : ""}
                          {BUDSJETT_KATEGORI[b.category]}
                        </div>
                      </Td>
                      <Td className="hidden text-sm text-tekst-svak sm:table-cell">{b.year}</Td>
                      <Td className="text-right text-sm tabular-nums">
                        {kroner(toNumber(b.amount))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {erLeder && (
              <CardBody className="border-t border-kant">
                <NyBudsjettSkjema
                  kostnadssteder={kostnadssteder.map((k) => ({
                    id: k.id,
                    etikett: `${k.code} — ${k.name}`,
                  }))}
                />
              </CardBody>
            )}
          </Card>
        </div>

        {erAdmin && (
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Download className="size-4 text-tekst-svak" aria-hidden />
                  Last ned alt dere har lagt inn
                </span>
              }
              description="Dataene er deres. Ta en kopi når som helst."
            />
            <CardBody>
              <p className="mb-3 text-sm text-tekst-svak">
                Hele bedriften i én fil: anlegg, arbeidsordre, timer, deler,
                avvik, skjemaer og alt annet. Regnearket har ett ark per
                tabell og kan åpnes med en gang. JSON er til den som skal
                lese fila maskinelt eller flytte dataene til et annet system.
              </p>
              <p className="mb-4 text-sm text-tekst-svak">
                Passord er ikke med. De lagres bare som hash og kan ikke leses
                ut av noen — heller ikke av oss.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/innstillinger/eksport"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tekst ring-1 ring-kant-sterk ring-inset hover:bg-flate-hover"
                >
                  <Download className="size-4" aria-hidden />
                  Regneark
                </a>
                <a
                  href="/innstillinger/eksport?format=json"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tekst-svak ring-1 ring-kant ring-inset hover:bg-flate-hover hover:text-tekst"
                >
                  JSON
                </a>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
