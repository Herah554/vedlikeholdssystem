import type { Metadata } from "next";
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
          <CardHeader title="Organisasjon" />
          <CardBody>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Navn</dt>
                <dd className="font-medium text-slate-900">{org?.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Organisasjonsnummer</dt>
                <dd className="font-medium text-slate-900">{org?.orgNumber ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Standard timepris</dt>
                <dd className="font-medium text-slate-900">
                  {org ? kroner(toNumber(org.hourlyRate)) : "–"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Din rolle</dt>
                <dd className="font-medium text-slate-900">
                  {ROLLE_BESKRIVELSE[session.role]}
                </dd>
              </div>
            </dl>
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
                    <span className="text-sm font-medium text-slate-900">{b.name}</span>
                    {b.id === session.userId && (
                      <span className="ml-1.5 text-xs text-slate-400">(deg)</span>
                    )}
                    <div className="text-xs text-slate-500 sm:hidden">{b.email}</div>
                  </Td>
                  <Td className="hidden text-sm text-slate-600 sm:table-cell">{b.email}</Td>
                  <Td>
                    <RolleVelger brukerId={b.id} rolle={b.role} kanEndre={erAdmin} />
                  </Td>
                  <Td className="hidden text-sm whitespace-nowrap text-slate-500 lg:table-cell">
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
                      <Td className="w-20 font-mono text-xs text-slate-500">{k.code}</Td>
                      <Td className="text-sm text-slate-900">{k.name}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {erLeder && (
              <CardBody className="border-t border-slate-100">
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
                        <span className="text-sm text-slate-900">{b.name}</span>
                        <div className="text-xs text-slate-500">
                          {b.costCenter ? `${b.costCenter.code} ` : ""}
                          {BUDSJETT_KATEGORI[b.category]}
                        </div>
                      </Td>
                      <Td className="hidden text-sm text-slate-600 sm:table-cell">{b.year}</Td>
                      <Td className="text-right text-sm tabular-nums">
                        {kroner(toNumber(b.amount))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {erLeder && (
              <CardBody className="border-t border-slate-100">
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
      </div>
    </>
  );
}
