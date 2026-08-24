import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShieldAlert } from "lucide-react";
import { kanSession, requireModul } from "@/lib/auth";
import type { DeviationStatus } from "@/generated/prisma/client";
import {
  APNE_AVVIK,
  AVVIK_ALVOR,
  AVVIK_STATUS,
  AVVIK_TYPE,
  avviksNummer,
} from "@/lib/domene";
import { dato } from "@/lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

export const metadata: Metadata = { title: "Avvik" };

export default async function AvvikSide(props: PageProps<"/avvik">) {
  const { db, session } = await requireModul("avvik");
  const sp = await props.searchParams;
  const bare = typeof sp.status === "string" ? sp.status : "apne";

  const filter =
    bare === "alle"
      ? {}
      : bare === "lukket"
        ? { status: { in: ["LUKKET", "AVVIST"] as DeviationStatus[] } }
        : { status: { in: APNE_AVVIK } };

  const [avvik, apne, kritiske, forsinket] = await Promise.all([
    db.deviation.findMany({
      where: filter,
      include: {
        asset: { select: { code: true, name: true } },
        reportedBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { occurredAt: "desc" }],
      take: 200,
    }),
    db.deviation.count({ where: { status: { in: APNE_AVVIK } } }),
    db.deviation.count({
      where: { status: { in: APNE_AVVIK }, severity: { in: ["KRITISK", "HOY"] } },
    }),
    db.deviation.count({
      where: { status: { in: APNE_AVVIK }, deadline: { lt: new Date() } },
    }),
  ]);

  const kanMelde = kanSession(session, "avvik", "endre");

  const faner = [
    { id: "apne", tekst: "Åpne" },
    { id: "lukket", tekst: "Lukket" },
    { id: "alle", tekst: "Alle" },
  ];

  return (
    <>
      <PageHeader
        title="Avvik"
        description="Hendelser som gikk galt, eller nesten gikk galt."
        action={
          kanMelde && (
            <ButtonLink href="/avvik/ny">
              <Plus className="size-4" aria-hidden />
              Meld avvik
            </ButtonLink>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Åpne avvik" value={apne} />
        <StatCard
          label="Kritisk eller høy"
          value={kritiske}
          tone={kritiske > 0 ? "kritisk" : "nøytral"}
        />
        <StatCard
          label="Over frist"
          value={forsinket}
          tone={forsinket > 0 ? "advarsel" : "nøytral"}
        />
      </div>

      <div className="mb-4 flex gap-1">
        {faner.map((f) => (
          <Link
            key={f.id}
            href={f.id === "apne" ? "/avvik" : `/avvik?status=${f.id}`}
            className={
              bare === f.id
                ? "rounded-lg bg-merke-50 px-3 py-1.5 text-sm font-medium text-aksent dark:bg-merke-500/15"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-tekst-svak hover:bg-flate-dempet"
            }
          >
            {f.tekst}
          </Link>
        ))}
      </div>

      <Card>
        {avvik.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="size-6" aria-hidden />}
            title="Ingen avvik her"
            description={
              bare === "apne"
                ? "Ingenting står åpent akkurat nå."
                : "Ingen avvik er registrert ennå."
            }
            action={
              kanMelde && (
                <ButtonLink href="/avvik/ny" variant="sekundær">
                  Meld det første
                </ButtonLink>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-kant">
            {avvik.map((a) => {
              const overFrist =
                a.deadline &&
                a.deadline < new Date() &&
                APNE_AVVIK.includes(a.status);

              return (
                <li key={a.id}>
                  <Link
                    href={`/avvik/${a.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-flate-hover"
                  >
                    <span className="font-mono text-xs text-tekst-svakest">
                      {avviksNummer(a.number)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-tekst">
                        {a.title}
                      </span>
                      <span className="block truncate text-xs text-tekst-svak">
                        {dato(a.occurredAt)}
                        {a.asset && ` · ${a.asset.code}`}
                        {a.location && ` · ${a.location}`}
                        {" · meldt av "}
                        {a.reportedBy.name}
                        {a.assignedTo && ` · ansvarlig ${a.assignedTo.name}`}
                      </span>
                    </span>

                    {overFrist && (
                      <Badge className="bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">
                        over frist
                      </Badge>
                    )}
                    <Badge className={AVVIK_TYPE[a.type].klasse}>
                      {AVVIK_TYPE[a.type].tekst}
                    </Badge>
                    <Badge className={AVVIK_ALVOR[a.severity].klasse}>
                      {AVVIK_ALVOR[a.severity].tekst}
                    </Badge>
                    <Badge className={AVVIK_STATUS[a.status].klasse}>
                      {AVVIK_STATUS[a.status].tekst}
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
