import Link from "next/link";
import type { Session } from "@/lib/auth";
import type { WidgetType } from "@/components/widget-katalog";
import type { TenantDb } from "@/lib/tenant";
import {
  hentNokkeltall,
  kostnadPerManed,
  nedetidPerUtstyr,
  ordrerPerStatus,
  pmEtterlevelse,
} from "@/lib/statistikk";
import { ORDRE_STATUS, PRIORITET } from "@/lib/domene";
import { dato, kroner, ordreNummer, relativTid, tall } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui";
import { KostnadLinje, NedetidSoyler, StatusSoyler } from "@/components/diagrammer";

/**
 * Widgets til dashbordet.
 *
 * Hver widget henter sine egne data. Det gjør at brukeren kan sette sammen
 * dashbordet fritt uten at siden må vite på forhånd hva som skal vises,
 * og Next.js kan strømme dem inn etter hvert som de blir ferdige.
 */


type Ctx = { db: TenantDb; session: Session };

// ─── Enkeltwidgets ────────────────────────────────────────────

async function Nokkeltall({ db, session, type }: Ctx & { type: WidgetType }) {
  const t = await hentNokkeltall(db, session.organizationId);

  switch (type) {
    case "apne-ordrer":
      return (
        <StatCard
          label="Åpne arbeidsordre"
          value={t.apneOrdrer}
          sub={t.forfalteOrdrer > 0 ? `${t.forfalteOrdrer} har passert frist` : "Ingen over frist"}
          tone={t.forfalteOrdrer > 0 ? "advarsel" : "nøytral"}
          href="/arbeidsordre"
        />
      );
    case "kritiske-ordrer":
      return (
        <StatCard
          label="Kritiske jobber"
          value={t.kritiskeOrdrer}
          sub="Krever handling nå"
          tone={t.kritiskeOrdrer > 0 ? "kritisk" : "god"}
          href="/arbeidsordre?prioritet=KRITISK"
        />
      );
    case "forfalt-pm":
      return (
        <StatCard
          label="Forfalt forebyggende"
          value={t.forfaltePmPlaner}
          sub="Planer over forfallsdato"
          tone={t.forfaltePmPlaner > 0 ? "advarsel" : "god"}
          href="/forebyggende"
        />
      );
    case "lav-beholdning":
      return (
        <StatCard
          label="Deler under minimum"
          value={t.delerUnderMinimum}
          sub="Bør bestilles"
          tone={t.delerUnderMinimum > 0 ? "advarsel" : "god"}
          href="/reservedeler?filter=lav"
        />
      );
    case "nedetid-30":
      return (
        <StatCard
          label="Nedetid siste 30 dager"
          value={`${tall(t.nedetidSiste30Dager / 60, 1)} t`}
          sub="Meldt stopptid"
          tone={t.nedetidSiste30Dager > 600 ? "advarsel" : "nøytral"}
        />
      );
    case "kostnad-hittil":
      return (
        <StatCard
          label="Kostnad hittil i år"
          value={kroner(t.kostnadHittilIAr)}
          sub="Timer og deler"
          href="/budsjett"
        />
      );
    default:
      return null;
  }
}

async function PmEtterlevelseKort({ db, session }: Ctx) {
  const e = await pmEtterlevelse(db, session.organizationId);
  return (
    <StatCard
      label="PM-etterlevelse"
      value={`${e.prosent} %`}
      sub={`${e.iTide} av ${e.totalt} utført i tide`}
      tone={e.prosent >= 90 ? "god" : e.prosent >= 75 ? "advarsel" : "kritisk"}
      href="/rapporter"
    />
  );
}

async function OrdrerPerStatus({ db }: Ctx) {
  const rader = await ordrerPerStatus(db);
  const FARGER: Record<string, string> = {
    MELDT: "#94a3b8", GODKJENT: "#0ea5e9", PLANLAGT: "#6366f1",
    PAAGAAR: "#f59e0b", VENTER_DELER: "#f97316", UTFORT: "#10b981",
    LUKKET: "#64748b", AVVIST: "#ef4444",
  };

  const data = rader.map((r) => ({
    navn: ORDRE_STATUS[r.status].tekst,
    antall: r.antall,
    farge: FARGER[r.status] ?? "#94a3b8",
  }));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Arbeidsordre per status" description="Alle ordre i systemet" />
      <CardBody className="min-h-0 flex-1 overflow-auto pt-2">
        {data.length ? <StatusSoyler data={data} hoyde="100%" /> : <EmptyState title="Ingen arbeidsordre ennå" />}
      </CardBody>
    </Card>
  );
}

async function KostnadPerManed({ session }: Ctx) {
  const data = await kostnadPerManed(session.organizationId);
  const sum = data.reduce((s, d) => s + d.arbeid + d.deler, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Kostnad per måned"
        description={`Siste tolv måneder — totalt ${kroner(sum)}`}
      />
      <CardBody className="min-h-0 flex-1 overflow-auto pt-2">
        <KostnadLinje data={data} hoyde="100%" />
      </CardBody>
    </Card>
  );
}

async function NedetidPerUtstyr({ session }: Ctx) {
  const data = await nedetidPerUtstyr(session.organizationId);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Nedetid per utstyr" description="Siste tolv måneder" />
      <CardBody className="min-h-0 flex-1 overflow-auto pt-2">
        {data.length ? (
          <NedetidSoyler data={data} hoyde="100%" />
        ) : (
          <EmptyState title="Ingen nedetid registrert" description="Nedetid føres på arbeidsordren når jobben lukkes." />
        )}
      </CardBody>
    </Card>
  );
}

async function MineJobber({ db, session }: Ctx) {
  const ordrer = await db.workOrder.findMany({
    where: {
      assignedToId: session.userId,
      status: { in: ["GODKJENT", "PLANLAGT", "PAAGAAR", "VENTER_DELER"] },
    },
    include: { asset: { select: { code: true, name: true } } },
    orderBy: [{ priority: "asc" }, { plannedDate: "asc" }],
    take: 6,
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Mine jobber"
        description="Tildelt deg og ikke avsluttet"
        action={
          <Link href="/arbeidsordre?mine=1" className="text-sm font-medium text-aksent hover:text-aksent">
            Se alle
          </Link>
        }
      />
      {ordrer.length === 0 ? (
        <EmptyState title="Ingen åpne jobber" description="Du har ingen arbeidsordre tildelt akkurat nå." />
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-kant overflow-auto">
          {ordrer.map((o) => (
            <li key={o.id}>
              <Link href={`/arbeidsordre/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-flate-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tekst">{o.title}</p>
                  <p className="truncate text-xs text-tekst-svak">
                    {ordreNummer(o.number)}
                    {o.asset && ` · ${o.asset.code} ${o.asset.name}`}
                    {o.plannedDate && ` · planlagt ${dato(o.plannedDate)}`}
                  </p>
                </div>
                <Badge className={PRIORITET[o.priority].klasse}>{PRIORITET[o.priority].tekst}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function SisteOrdrer({ db }: Ctx) {
  const ordrer = await db.workOrder.findMany({
    include: {
      asset: { select: { code: true } },
      requestedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Siste meldinger" description="Nyeste arbeidsordre" />
      <ul className="min-h-0 flex-1 divide-y divide-kant overflow-auto">
        {ordrer.map((o) => (
          <li key={o.id}>
            <Link href={`/arbeidsordre/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-flate-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-tekst">{o.title}</p>
                <p className="truncate text-xs text-tekst-svak">
                  {o.requestedBy.name} · {relativTid(o.createdAt)}
                  {o.asset && ` · ${o.asset.code}`}
                </p>
              </div>
              <Badge className={ORDRE_STATUS[o.status].klasse}>{ORDRE_STATUS[o.status].tekst}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Fordeler ─────────────────────────────────────────────────

/** Velger riktig widget ut fra typen som er lagret i oppsettet. */
export function Widget({ type, db, session }: Ctx & { type: WidgetType }) {
  switch (type) {
    case "apne-ordrer":
    case "kritiske-ordrer":
    case "forfalt-pm":
    case "lav-beholdning":
    case "nedetid-30":
    case "kostnad-hittil":
      return <Nokkeltall type={type} db={db} session={session} />;
    case "pm-etterlevelse":
      return <PmEtterlevelseKort db={db} session={session} />;
    case "ordrer-per-status":
      return <OrdrerPerStatus db={db} session={session} />;
    case "kostnad-per-maaned":
      return <KostnadPerManed db={db} session={session} />;
    case "nedetid-per-utstyr":
      return <NedetidPerUtstyr db={db} session={session} />;
    case "mine-jobber":
      return <MineJobber db={db} session={session} />;
    case "siste-ordrer":
      return <SisteOrdrer db={db} session={session} />;
    case "utloper-snart":
      return <UtloperSnart db={db} session={session} />;
    default:
      return null;
  }
}


/**
 * Dokumenter som nærmer seg utløp, og de som allerede har gått ut.
 *
 * Nitti dager fram i tid. Et kalibreringsbevis må bestilles, utstyret sendes
 * inn og komme tilbake — får man beskjed uka før, er det for sent. De som
 * allerede har gått ut står øverst, fordi de betyr at utstyret i praksis ikke
 * kan brukes til noe som teller.
 */
async function UtloperSnart({ db }: Ctx) {
  const grense = new Date();
  grense.setDate(grense.getDate() + 90);

  const dokumenter = await db.attachment.findMany({
    where: { validUntil: { not: null, lte: grense } },
    include: { asset: { select: { id: true, code: true, name: true } } },
    orderBy: { validUntil: "asc" },
    take: 12,
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Går snart ut"
        description="Kalibreringsbevis og sertifikater med utløp innen tre måneder"
      />
      {dokumenter.length === 0 ? (
        <EmptyState
          title="Ingenting går ut med det første"
          description="Dokumenter med utløpsdato dukker opp her når det nærmer seg."
        />
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-kant overflow-auto">
          {dokumenter.map((d) => {
            const dager = Math.ceil(
              (d.validUntil!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const utgatt = dager < 0;

            return (
              <li key={d.id}>
                <Link
                  href={d.asset ? `/anlegg/${d.asset.id}` : d.url}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-flate-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tekst">
                      {d.fileName}
                    </p>
                    <p className="truncate text-xs text-tekst-svak">
                      {d.asset
                        ? `${d.asset.code} · ${d.asset.name}`
                        : "Ikke knyttet til utstyr"}
                      {d.reference && ` · ${d.reference}`}
                    </p>
                  </div>
                  <Badge
                    className={
                      utgatt
                        ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
                        : dager <= 30
                          ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
                          : "bg-flate-dempet text-tekst-svak ring-kant"
                    }
                  >
                    {utgatt
                      ? `${Math.abs(dager)} d over`
                      : `${dager} d igjen`}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
