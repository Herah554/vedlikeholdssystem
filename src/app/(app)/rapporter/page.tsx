import type { Metadata } from "next";
import Link from "next/link";
import { requireModul } from "@/lib/auth";
import {
  arbeidsfordeling,
  delerMestBrukt,
  etterslep,
  forebyggendeAndel,
  kostnadPerUtstyr,
  meldtMotUtfort,
  nedetidPerUtstyr,
  pmEtterlevelse,
  reparasjonstid,
} from "@/lib/statistikk";
import { ordreType } from "@/lib/domene";
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
import {
  ArbeidstypeSoyler,
  MeldtUtfortSoyler,
  NedetidSoyler,
  ReparasjonstidLinje,
} from "@/components/diagrammer";

export const metadata: Metadata = { title: "Rapporter" };

export default async function RapporterSide() {
  const { db, session } = await requireModul("rapporter");

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

  // De fire nye rapportene er uavhengige av hverandre og hentes samtidig.
  const [balanse, arbeidstype, tidsbruk, kø] = await Promise.all([
    meldtMotUtfort(session.organizationId),
    forebyggendeAndel(session.organizationId),
    reparasjonstid(session.organizationId),
    etterslep(session.organizationId),
  ]);

  const sisteTolv = balanse.reduce(
    (s, m) => ({ meldt: s.meldt + m.meldt, utfort: s.utfort + m.utfort }),
    { meldt: 0, utfort: 0 },
  );
  const balansePunkt = sisteTolv.meldt - sisteTolv.utfort;

  const gamleJobber = kø
    .filter((b) => b.rekkefolge >= 4)
    .reduce((s, b) => s + b.antall, 0);

  const sisteMedian = [...tidsbruk].reverse().find((m) => m.median !== null);

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
        <StatCard
          label="Meldt mot utført"
          value={balansePunkt > 0 ? `+${balansePunkt}` : String(balansePunkt)}
          sub={
            balansePunkt > 0
              ? "flere kom inn enn ble gjort"
              : balansePunkt < 0
                ? "etterslepet krymper"
                : "i balanse"
          }
          tone={balansePunkt > 10 ? "kritisk" : balansePunkt > 0 ? "advarsel" : "god"}
        />
        <StatCard
          label="Typisk reparasjonstid"
          value={sisteMedian?.median != null ? `${tall(sisteMedian.median, 1)} d` : "—"}
          sub="Median, siste måned med data"
        />
        <StatCard
          label="Eldre enn tre måneder"
          value={gamleJobber}
          sub="Åpne jobber som har blitt liggende"
          tone={gamleJobber > 5 ? "kritisk" : gamleJobber > 0 ? "advarsel" : "god"}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Holder vi tritt?"
            description="Jobber meldt inn mot jobber utført, måned for måned. Ligger den gule søylen jevnt over den grønne, vokser etterslepet."
          />
          <CardBody className="pt-2">
            {balanse.some((m) => m.meldt > 0 || m.utfort > 0) ? (
              <MeldtUtfortSoyler data={balanse} />
            ) : (
              <EmptyState title="Ingen arbeidsordre siste år" />
            )}
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Planlagt mot uplanlagt"
              description="Andelen forebyggende arbeid er målet på om vedlikeholdet er under kontroll. Bransjen sikter mot rundt to tredeler planlagt."
            />
            <CardBody className="pt-2">
              {arbeidstype.some(
                (m) => m.forebyggende + m.korrektiv + m.annet > 0,
              ) ? (
                <ArbeidstypeSoyler data={arbeidstype} />
              ) : (
                <EmptyState title="Ingen arbeidsordre siste år" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Hvor lenge tar jobbene?"
              description="Fra en feil meldes til den er utført. Medianen sier mer enn snittet — én jobb som ble liggende i et halvår drar snittet opp for alle."
            />
            <CardBody className="pt-2">
              {tidsbruk.some((m) => m.antall > 0) ? (
                <ReparasjonstidLinje data={tidsbruk} />
              ) : (
                <EmptyState title="Ingen fullførte jobber ennå" />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Hvor gammelt er etterslepet?"
            description="Åpne jobber etter hvor lenge de har ligget. En jobb fra i går er noe annet enn en fra i fjor."
          />
          <CardBody>
            {kø.length === 0 ? (
              <EmptyState
                title="Ingenting står åpent"
                description="Alle meldte jobber er utført eller lukket."
              />
            ) : (
              <ul className="space-y-2">
                {kø.map((b) => {
                  const storst = Math.max(...kø.map((x) => x.antall));
                  const gammel = b.rekkefolge >= 4;

                  return (
                    <li key={b.bolk} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-tekst-svak sm:w-44 sm:text-sm">
                        {b.bolk}
                      </span>
                      <span className="h-6 flex-1 overflow-hidden rounded bg-flate-dempet">
                        <span
                          className={
                            gammel
                              ? "block h-full rounded bg-red-500/70"
                              : "block h-full rounded bg-merke-500/60"
                          }
                          style={{ width: `${Math.max(4, (b.antall / storst) * 100)}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-tekst">
                        {b.antall}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

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
                        className="text-sm font-medium text-tekst hover:text-aksent"
                      >
                        <span className="font-mono text-xs text-tekst-svak">{k.kode}</span>{" "}
                        {k.navn}
                      </Link>
                    </Td>
                    <Td className="text-right text-sm text-tekst-svak tabular-nums">
                      {k.antallOrdrer}
                    </Td>
                    <Td className="hidden text-right text-sm text-tekst-svak tabular-nums sm:table-cell">
                      {kroner(k.arbeid)}
                    </Td>
                    <Td className="hidden text-right text-sm text-tekst-svak tabular-nums sm:table-cell">
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
                            <span className="font-medium text-tekst">
                              {ordreType(f.type).tekst}
                            </span>
                            <span className="text-tekst-svak tabular-nums">
                              {f.antall} stk · {andel} %
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-flate-dempet">
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
              <p className="mt-4 border-t border-kant pt-3 text-xs text-tekst-svak">
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
                          className="text-sm text-tekst hover:text-aksent"
                        >
                          <span className="font-mono text-xs text-tekst-svak">{d.nummer}</span>{" "}
                          {d.navn}
                        </Link>
                      </Td>
                      <Td className="text-right text-sm text-tekst-svak tabular-nums">
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
