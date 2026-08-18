import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  arbeidsfordeling,
  delerMestBrukt,
  kostnadPerUtstyr,
  nedetidPerUtstyr,
  pmEtterlevelse,
} from "@/lib/statistikk";
import { ORDRE_TYPE } from "@/lib/domene";
import { kroner, tall } from "@/lib/format";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { NedetidSoyler } from "@/components/diagrammer";

export const metadata: Metadata = { title: "Rapporter" };

export default async function RapporterSide() {
  const { db, session } = await requireTenant();

  const [kostnad, nedetid, etterlevelse, fordeling, deler] = await Promise.all([
    kostnadPerUtstyr(session.organizationId),
    nedetidPerUtstyr(session.organizationId, 10),
    pmEtterlevelse(db, session.organizationId),
    arbeidsfordeling(db),
    delerMestBrukt(session.organizationId),
  ]);

  const totaltAntall = fordeling.reduce((s, f) => s + f.antall, 0);
  const forebyggende = fordeling.find((f) => f.type === "FOREBYGGENDE")?.antall ?? 0;
  const andelForebyggende =
    totaltAntall === 0 ? 0 : Math.round((forebyggende / totaltAntall) * 100);

  const samletNedetid = nedetid.reduce((s, n) => s + n.minutter, 0);
  const samletKostnad = kostnad.reduce((s, k) => s + k.arbeid + k.deler, 0);

  return (
    <>
      <PageHeader
        title="Rapporter"
        description="Tallene bak driften — siste tolv måneder"
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="PM-etterlevelse"
          value={`${etterlevelse.prosent} %`}
          sub={`${etterlevelse.iTide} av ${etterlevelse.totalt} i tide`}
          tone={
            etterlevelse.prosent >= 90
              ? "god"
              : etterlevelse.prosent >= 75
                ? "advarsel"
                : "kritisk"
          }
        />
        <StatCard
          label="Andel forebyggende"
          value={`${andelForebyggende} %`}
          sub="Av alt arbeid siste år"
          tone={andelForebyggende >= 60 ? "god" : andelForebyggende >= 40 ? "advarsel" : "kritisk"}
        />
        <StatCard label="Samlet nedetid" value={`${tall(samletNedetid / 60, 1)} t`} />
        <StatCard label="Samlet kostnad" value={kroner(samletKostnad)} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Hva koster utstyret oss?"
            description="Arbeid og deler samlet, høyest først. Utstyr på toppen av lista er kandidater for utskifting eller bedre forebygging."
          />
          {kostnad.length === 0 ? (
            <EmptyState title="Ingen kostnader registrert" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Utstyr</Th>
                  <Th className="text-right">Arbeidsordre</Th>
                  <Th className="hidden text-right sm:table-cell">Arbeid</Th>
                  <Th className="hidden text-right sm:table-cell">Deler</Th>
                  <Th className="text-right">Sum</Th>
                </tr>
              </thead>
              <tbody>
                {kostnad.map((k) => (
                  <Tr key={k.id}>
                    <Td>
                      <Link
                        href={`/anlegg/${k.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-merke-600"
                      >
                        <span className="font-mono text-xs text-slate-500">{k.kode}</span>{" "}
                        {k.navn}
                      </Link>
                    </Td>
                    <Td className="text-right text-sm text-slate-600 tabular-nums">
                      {k.antallOrdrer}
                    </Td>
                    <Td className="hidden text-right text-sm text-slate-600 tabular-nums sm:table-cell">
                      {kroner(k.arbeid)}
                    </Td>
                    <Td className="hidden text-right text-sm text-slate-600 tabular-nums sm:table-cell">
                      {kroner(k.deler)}
                    </Td>
                    <Td className="text-right text-sm font-medium tabular-nums">
                      {kroner(k.arbeid + k.deler)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Nedetid per utstyr"
            description="Hvor produksjonen faktisk taper tid"
          />
          <CardBody className="pt-2">
            {nedetid.length ? (
              <NedetidSoyler data={nedetid} />
            ) : (
              <EmptyState title="Ingen nedetid registrert" />
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Fordeling av arbeidet"
              description="Forebyggende mot korrektivt siste år"
            />
            <CardBody>
              {totaltAntall === 0 ? (
                <EmptyState title="Ingen arbeidsordre siste år" />
              ) : (
                <ul className="space-y-3">
                  {fordeling
                    .sort((a, b) => b.antall - a.antall)
                    .map((f) => {
                      const andel = Math.round((f.antall / totaltAntall) * 100);
                      return (
                        <li key={f.type}>
                          <div className="mb-1 flex items-baseline justify-between text-sm">
                            <span className="font-medium text-slate-700">
                              {ORDRE_TYPE[f.type].tekst}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              {f.antall} stk · {andel} %
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                f.type === "FOREBYGGENDE"
                                  ? "bg-emerald-500"
                                  : f.type === "KORREKTIV"
                                    ? "bg-rose-500"
                                    : "bg-sky-500"
                              }`}
                              style={{ width: `${andel}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Et anlegg med god kontroll ligger typisk over 60 % forebyggende.
                Er andelen lav, går tiden med til brannslukking.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Mest brukte reservedeler"
              description="Etter kostnad siste år"
            />
            {deler.length === 0 ? (
              <EmptyState title="Ingen deleforbruk registrert" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Del</Th>
                    <Th className="text-right">Forbruk</Th>
                    <Th className="text-right">Kostnad</Th>
                  </tr>
                </thead>
                <tbody>
                  {deler.map((d) => (
                    <Tr key={d.id}>
                      <Td>
                        <Link
                          href={`/reservedeler/${d.id}`}
                          className="text-sm text-slate-900 hover:text-merke-600"
                        >
                          <span className="font-mono text-xs text-slate-500">{d.nummer}</span>{" "}
                          {d.navn}
                        </Link>
                      </Td>
                      <Td className="text-right text-sm text-slate-600 tabular-nums">
                        {tall(d.forbruk)} {d.enhet}
                      </Td>
                      <Td className="text-right text-sm font-medium tabular-nums">
                        {kroner(d.kostnad)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
