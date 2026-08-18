import type { Metadata } from "next";
import Link from "next/link";
import { Network, Plus } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ANLEGG_STATUS, ANLEGG_TYPE, KRITIKALITET } from "@/lib/domene";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Anlegg" };

export default async function AnleggSide() {
  const { db, session } = await requireTenant();

  const utstyr = await db.asset.findMany({
    orderBy: { path: "asc" },
    select: {
      id: true, code: true, name: true, type: true, depth: true,
      status: true, criticality: true, location: true,
    },
  });

  // Antall åpne arbeidsordre per utstyr, hentet i én spørring i stedet for
  // én per rad — ellers vokser sidelastingen med antall maskiner.
  const apneRader = await prisma.$queryRaw<{ assetId: string; antall: bigint }[]>`
    SELECT "assetId", count(*) AS antall
    FROM work_orders
    WHERE "organizationId" = ${session.organizationId}
      AND "assetId" IS NOT NULL
      AND status IN ('MELDT', 'GODKJENT', 'PLANLAGT', 'PAAGAAR', 'VENTER_DELER')
    GROUP BY "assetId"
  `;
  const apne = new Map(apneRader.map((r) => [r.assetId, Number(r.antall)]));

  return (
    <>
      <PageHeader
        title="Anlegg"
        description="Hierarkiet over anlegg, systemer og utstyr"
        action={
          <ButtonLink href="/anlegg/ny">
            <Plus className="size-4" aria-hidden />
            Nytt utstyr
          </ButtonLink>
        }
      />

      <Card>
        {utstyr.length === 0 ? (
          <EmptyState
            icon={<Network className="size-10" />}
            title="Ingen anlegg registrert"
            description="Start med å legge inn anlegget øverst, og bygg deretter ut med systemer og utstyr under."
            action={
              <ButtonLink href="/anlegg/ny">
                <Plus className="size-4" aria-hidden />
                Nytt utstyr
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {utstyr.map((u) => {
              const antallApne = apne.get(u.id) ?? 0;
              return (
                <li key={u.id}>
                  <Link
                    href={`/anlegg/${u.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                    // Innrykket viser hvor i hierarkiet enheten hører hjemme
                    style={{ paddingLeft: `${1.25 + u.depth * 1.5}rem` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{u.code}</span>
                        <span
                          className={
                            u.depth === 0
                              ? "font-semibold text-slate-900"
                              : "text-sm font-medium text-slate-900"
                          }
                        >
                          {u.name}
                        </span>
                        <span className="text-xs text-slate-400">{ANLEGG_TYPE[u.type]}</span>
                      </div>
                      {u.location && (
                        <p className="mt-0.5 text-xs text-slate-500">{u.location}</p>
                      )}
                    </div>

                    {antallApne > 0 && (
                      <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                        {antallApne} åpne
                      </Badge>
                    )}
                    {u.criticality >= 4 && (
                      <Badge className={KRITIKALITET[u.criticality].klasse}>
                        {KRITIKALITET[u.criticality].tekst}
                      </Badge>
                    )}
                    <Badge className={ANLEGG_STATUS[u.status].klasse}>
                      {ANLEGG_STATUS[u.status].tekst}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
