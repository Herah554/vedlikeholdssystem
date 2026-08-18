import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { budsjettMotForbruk, kostnadPerManed } from "@/lib/statistikk";
import { BUDSJETT_KATEGORI } from "@/lib/domene";
import { kroner, tall, toNumber } from "@/lib/format";
import {
  Badge,
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
import { BudsjettSoyler, KostnadLinje } from "@/components/diagrammer";

export const metadata: Metadata = { title: "Budsjett" };

export default async function BudsjettSide(props: PageProps<"/budsjett">) {
  const { db, session } = await requireTenant();
  const sp = await props.searchParams;

  const iAr = new Date().getFullYear();
  const valgtAr = Number(sp.ar ?? iAr);
  const ar = Number.isInteger(valgtAr) ? valgtAr : iAr;

  const [rader, perManed, budsjettlinjer] = await Promise.all([
    budsjettMotForbruk(session.organizationId, ar),
    kostnadPerManed(session.organizationId),
    db.budget.findMany({
      where: { year: ar },
      include: { costCenter: { select: { code: true, name: true } } },
      orderBy: [{ costCenterId: "asc" }, { category: "asc" }],
    }),
  ]);

  const sumBudsjett = rader.reduce((s, r) => s + r.budsjett, 0);
  const sumForbruk = rader.reduce((s, r) => s + r.arbeid + r.deler, 0);
  const igjen = sumBudsjett - sumForbruk;

  // Hvor langt ut i året vi er — brukes til å si om forbruket ligger an
  // til å sprenge budsjettet, ikke bare om det har gjort det ennå.
  const dagerIAr = (ar % 4 === 0 && ar % 100 !== 0) || ar % 400 === 0 ? 366 : 365;
  const dagerGatt =
    ar === iAr
      ? Math.ceil(
          (Date.now() - new Date(ar, 0, 1).getTime()) / 86400_000,
        )
      : dagerIAr;
  const andelAvAret = Math.min(dagerGatt / dagerIAr, 1);
  const forventet = sumBudsjett * andelAvAret;

  return (
    <>
      <PageHeader
        title="Budsjett"
        description={`Kostnader mot budsjett for ${ar}`}
        action={
          <div className="flex items-center gap-1">
            {[iAr - 1, iAr, iAr + 1].map((n) => (
              <Link
                key={n}
                href={n === iAr ? "/budsjett" : `/budsjett?ar=${n}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  n === ar
                    ? "bg-merke-50 text-merke-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Budsjett" value={kroner(sumBudsjett)} sub={`For hele ${ar}`} />
        <StatCard
          label="Forbrukt"
          value={kroner(sumForbruk)}
          sub={
            sumBudsjett > 0
              ? `${tall((sumForbruk / sumBudsjett) * 100)} % av budsjettet`
              : undefined
          }
          tone={sumForbruk > sumBudsjett ? "kritisk" : "nøytral"}
        />
        <StatCard
          label={igjen >= 0 ? "Igjen" : "Overskredet med"}
          value={kroner(Math.abs(igjen))}
          tone={igjen >= 0 ? "god" : "kritisk"}
        />
        <StatCard
          label="Forventet forbruk nå"
          value={kroner(forventet)}
          sub={
            sumForbruk > forventet
              ? "Ligger over takten"
              : "Ligger innenfor takten"
          }
          tone={sumForbruk > forventet ? "advarsel" : "god"}
        />
      </div>

      {rader.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-10" />}
            title="Ingen kostnadssteder"
            description="Opprett kostnadssteder og budsjetter under Innstillinger for å følge kostnadene."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Budsjett mot forbruk"
              description="Per kostnadssted"
            />
            <CardBody className="pt-2">
              <BudsjettSoyler
                data={rader.map((r) => ({
                  navn: r.kode,
                  budsjett: Math.round(r.budsjett),
                  forbrukt: Math.round(r.arbeid + r.deler),
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Detaljer per kostnadssted" />
            <Table>
              <thead>
                <tr>
                  <Th>Kostnadssted</Th>
                  <Th className="text-right">Budsjett</Th>
                  <Th className="hidden text-right sm:table-cell">Arbeid</Th>
                  <Th className="hidden text-right sm:table-cell">Deler</Th>
                  <Th className="text-right">Forbrukt</Th>
                  <Th className="text-right">Avvik</Th>
                  <Th className="w-32">Forbruk</Th>
                </tr>
              </thead>
              <tbody>
                {rader.map((r) => {
                  const forbrukt = r.arbeid + r.deler;
                  const avvik = r.budsjett - forbrukt;
                  const andel = r.budsjett > 0 ? forbrukt / r.budsjett : 0;
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">{r.kode}</span>
                        <br />
                        <span className="text-sm font-medium text-slate-900">{r.navn}</span>
                      </Td>
                      <Td className="text-right text-sm tabular-nums">{kroner(r.budsjett)}</Td>
                      <Td className="hidden text-right text-sm text-slate-600 tabular-nums sm:table-cell">
                        {kroner(r.arbeid)}
                      </Td>
                      <Td className="hidden text-right text-sm text-slate-600 tabular-nums sm:table-cell">
                        {kroner(r.deler)}
                      </Td>
                      <Td className="text-right text-sm font-medium tabular-nums">
                        {kroner(forbrukt)}
                      </Td>
                      <Td
                        className={`text-right text-sm font-medium tabular-nums ${
                          avvik < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {avvik < 0 ? "−" : "+"}
                        {kroner(Math.abs(avvik))}
                      </Td>
                      <Td>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                          role="img"
                          aria-label={`${tall(andel * 100)} prosent av budsjettet brukt`}
                        >
                          <div
                            className={`h-full rounded-full ${
                              andel > 1
                                ? "bg-red-500"
                                : andel > andelAvAret
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(andel * 100, 100)}%` }}
                          />
                        </div>
                        <span className="mt-1 block text-[11px] text-slate-500 tabular-nums">
                          {tall(andel * 100)} %
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader
              title="Kostnadsutvikling"
              description="Siste tolv måneder, arbeid og deler hver for seg"
            />
            <CardBody className="pt-2">
              <KostnadLinje data={perManed} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Budsjettlinjer"
              description={`Registrerte budsjetter for ${ar}`}
            />
            {budsjettlinjer.length === 0 ? (
              <EmptyState title="Ingen budsjettlinjer for dette året" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Navn</Th>
                    <Th>Kostnadssted</Th>
                    <Th>Kategori</Th>
                    <Th className="text-right">Beløp</Th>
                  </tr>
                </thead>
                <tbody>
                  {budsjettlinjer.map((b) => (
                    <Tr key={b.id}>
                      <Td className="text-sm font-medium text-slate-900">{b.name}</Td>
                      <Td className="text-sm text-slate-600">
                        {b.costCenter ? `${b.costCenter.code} ${b.costCenter.name}` : "–"}
                      </Td>
                      <Td>
                        <Badge>{BUDSJETT_KATEGORI[b.category]}</Badge>
                      </Td>
                      <Td className="text-right text-sm tabular-nums">
                        {kroner(toNumber(b.amount))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
