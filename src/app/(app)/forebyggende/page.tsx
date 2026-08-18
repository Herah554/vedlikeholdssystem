import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Repeat2 } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { PM_UTLOSER, PRIORITET } from "@/lib/domene";
import { dato, relativTid, tall, timer } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { AktivBryter, GenererKnapp, UtfortKnapp } from "./handlinger";

export const metadata: Metadata = { title: "Forebyggende vedlikehold" };

export default async function ForebyggendeSide() {
  const { db } = await requireTenant();

  const planer = await db.pmPlan.findMany({
    include: {
      asset: { select: { id: true, code: true, name: true, runningHours: true } },
      assignedTo: { select: { name: true } },
      workOrders: {
        where: { status: { in: ["MELDT", "GODKJENT", "PLANLAGT", "PAAGAAR", "VENTER_DELER"] } },
        select: { id: true, number: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { nextDueAt: "asc" }],
  });

  const nå = new Date();
  const forfalt = planer.filter(
    (p) => p.isActive && p.nextDueAt != null && p.nextDueAt < nå,
  );
  const snart = planer.filter(
    (p) =>
      p.isActive &&
      p.nextDueAt != null &&
      p.nextDueAt >= nå &&
      p.nextDueAt <= new Date(nå.getTime() + 30 * 86400_000),
  );

  return (
    <>
      <PageHeader
        title="Forebyggende vedlikehold"
        description="Planer som lager arbeidsordre automatisk før noe rekker å ryke"
        action={
          <ButtonLink href="/forebyggende/ny">
            <Plus className="size-4" aria-hidden />
            Ny plan
          </ButtonLink>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Aktive planer" value={planer.filter((p) => p.isActive).length} />
        <StatCard
          label="Forfalt"
          value={forfalt.length}
          tone={forfalt.length ? "kritisk" : "god"}
          sub="Skulle vært gjort"
        />
        <StatCard label="Forfaller innen 30 dager" value={snart.length} tone={snart.length ? "advarsel" : "god"} />
        <StatCard
          label="Har åpen jobb"
          value={planer.filter((p) => p.workOrders.length > 0).length}
          sub="Arbeidsordre er laget"
        />
      </div>

      <Card className="mb-4">
        <CardBody>
          <p className="mb-3 text-sm text-slate-600">
            Kjør denne når du planlegger uka. Systemet oppretter arbeidsordre for
            alle planer som forfaller innenfor varslingstiden sin, og hopper over
            dem som allerede har en åpen jobb.
          </p>
          <GenererKnapp />
        </CardBody>
      </Card>

      {planer.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat2 className="size-10" />}
            title="Ingen forebyggende planer"
            description="Uten planer blir alt vedlikehold brannslukking. Start med det mest kritiske utstyret."
            action={
              <ButtonLink href="/forebyggende/ny">
                <Plus className="size-4" aria-hidden />
                Ny plan
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {planer.map((p) => {
            const erForfalt = p.isActive && p.nextDueAt != null && p.nextDueAt < nå;
            const sidenSist = p.asset.runningHours - (p.lastDoneHours ?? 0);

            return (
              <Card
                key={p.id}
                className={erForfalt ? "border-red-200 bg-red-50/40" : undefined}
              >
                <CardBody className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">{p.name}</h3>
                      <Badge className={PRIORITET[p.priority].klasse}>
                        {PRIORITET[p.priority].tekst}
                      </Badge>
                      {erForfalt && (
                        <Badge className="bg-red-100 text-red-800 ring-red-200">
                          Forfalt {relativTid(p.nextDueAt)}
                        </Badge>
                      )}
                      {!p.isActive && <Badge>Deaktivert</Badge>}
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      <Link
                        href={`/anlegg/${p.asset.id}`}
                        className="text-merke-600 hover:text-merke-700"
                      >
                        {p.asset.code} — {p.asset.name}
                      </Link>
                    </p>

                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                      <div>
                        <dt className="inline">Utløser: </dt>
                        <dd className="inline text-slate-700">
                          {p.trigger === "TID"
                            ? `Hver ${p.intervalDays}. dag`
                            : `Hver ${tall(p.intervalHours ?? 0)}. driftstime`}
                        </dd>
                      </div>
                      {p.trigger === "TID" ? (
                        <div>
                          <dt className="inline">Neste: </dt>
                          <dd className="inline text-slate-700">
                            {p.nextDueAt ? dato(p.nextDueAt) : "ikke satt"}
                          </dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="inline">Siden sist: </dt>
                          <dd className="inline text-slate-700">
                            {tall(sidenSist)} av {tall(p.intervalHours ?? 0)} timer
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">Sist utført: </dt>
                        <dd className="inline text-slate-700">
                          {p.lastDoneAt ? dato(p.lastDoneAt) : "aldri"}
                        </dd>
                      </div>
                      {p.estimatedHours && (
                        <div>
                          <dt className="inline">Anslag: </dt>
                          <dd className="inline text-slate-700">{timer(p.estimatedHours)}</dd>
                        </div>
                      )}
                      {p.assignedTo && (
                        <div>
                          <dt className="inline">Ansvarlig: </dt>
                          <dd className="inline text-slate-700">{p.assignedTo.name}</dd>
                        </div>
                      )}
                    </dl>

                    {p.workOrders.length > 0 && (
                      <p className="mt-2 text-xs">
                        <Link
                          href={`/arbeidsordre/${p.workOrders[0].id}`}
                          className="text-merke-600 hover:text-merke-700"
                        >
                          Har allerede en åpen arbeidsordre →
                        </Link>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <UtfortKnapp planId={p.id} />
                    <AktivBryter planId={p.id} aktiv={p.isActive} />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
