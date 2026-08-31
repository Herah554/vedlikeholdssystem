"use client";

import {
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarOff, GripVertical } from "lucide-react";
import { ordreType, PRIORITET } from "@/lib/domene";
import { ordreNummer, timer } from "@/lib/format";
import { Badge } from "@/components/ui";
import { planleggOrdre } from "@/app/(app)/arbeidsordre/actions";

export type Jobb = {
  id: string;
  number: number;
  title: string;
  priority: keyof typeof PRIORITET;
  /** Kode fra lista «ordretype». Kan være noe firmaet har lagt til selv. */
  type: string;
  estimatedHours: number | null;
  assetCode: string | null;
  assignedTo: string | null;
};

export type Dag = { iso: string; navn: string; erIDag: boolean; jobber: Jobb[] };

/**
 * Dratilstanden kortene og kolonnene deler.
 *
 * Kort og Kolonne lå før inne i Tavle og leste dette gjennom lukningen. Det
 * ser uskyldig ut, men gjorde at React fikk to nye komponenttyper ved hver
 * eneste gjengivelse — og en ny type betyr at hele undertreet rives ned og
 * bygges opp igjen. På ei tavle man drar i, er det både treghet og tapt
 * tilstand: et åpent nedtrekksfelt lukker seg, og fokus forsvinner.
 *
 * Samlet i ett objekt framfor et titalls enkeltprops, slik at signaturene
 * fortsatt er til å lese.
 */
type Tavlestyring = {
  drar: string | null;
  settDrar: (id: string | null) => void;
  over: string | null;
  settOver: Dispatch<SetStateAction<string | null>>;
  venter: boolean;
  flytt: (ordreId: string, dato: string | null) => void;
  dager: Dag[];
  valg: { verdi: string; tekst: string }[];
};

/**
 * Ukeplantavla.
 *
 * Jobber flyttes ved å dra kortet til en annen dag. På nettbrett fungerer
 * ikke dra-og-slipp like godt, så hvert kort har også en nedtrekksliste
 * som gjør det samme — begge veier ender i den samme server-handlingen.
 */
export function Tavle({
  dager,
  uplanlagte,
}: {
  dager: Dag[];
  uplanlagte: Jobb[];
}) {
  const [venter, start] = useTransition();
  const [drar, settDrar] = useState<string | null>(null);
  const [over, settOver] = useState<string | null>(null);
  const router = useRouter();

  function flytt(ordreId: string, dato: string | null) {
    start(async () => {
      await planleggOrdre(ordreId, dato);
      router.refresh();
    });
  }

  const valg = [
    { verdi: "", tekst: "Ikke planlagt" },
    ...dager.map((d) => ({ verdi: d.iso, tekst: d.navn })),
  ];

  const styring: Tavlestyring = {
    drar,
    settDrar,
    over,
    settOver,
    venter,
    flytt,
    dager,
    valg,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {dager.map((d) => (
          <Kolonne
            key={d.iso}
            nokkel={d.iso}
            tittel={d.navn}
            undertittel={d.erIDag ? "i dag" : undefined}
            jobber={d.jobber}
            fremhev={d.erIDag}
            tom="Ingen jobber"
            styring={styring}
          />
        ))}
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-tekst">
          <CalendarOff className="size-4 text-tekst-svakest" aria-hidden />
          Ikke planlagt ennå
        </h2>
        <div className="flex gap-3">
          <Kolonne
            nokkel="uplanlagt"
            tittel="Venter på plassering"
            undertittel="Dra en jobb hit for å ta den ut av uka"
            jobber={uplanlagte}
            tom="Alt er planlagt"
            styring={styring}
          />
        </div>
      </div>
    </div>
  );
}

function Kort({ jobb, styring }: { jobb: Jobb; styring: Tavlestyring }) {
  const { drar, settDrar, settOver, dager, venter, flytt, valg } = styring;
  return (
    <li
      draggable
      onDragStart={() => settDrar(jobb.id)}
      onDragEnd={() => {
        settDrar(null);
        settOver(null);
      }}
      className={`kort cursor-grab p-2.5 active:cursor-grabbing ${
        drar === jobb.id ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-tekst-svakest" aria-hidden />
        <div className="min-w-0 flex-1">
          <Link
            href={`/arbeidsordre/${jobb.id}`}
            className="block text-sm leading-snug font-medium text-tekst hover:text-aksent"
          >
            {jobb.title}
          </Link>
          <p className="mt-0.5 font-mono text-[11px] text-tekst-svakest">
            {ordreNummer(jobb.number)}
            {jobb.assetCode && ` · ${jobb.assetCode}`}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Badge className={PRIORITET[jobb.priority].klasse}>
              {PRIORITET[jobb.priority].tekst}
            </Badge>
            <Badge className={ordreType(jobb.type).klasse}>
              {ordreType(jobb.type).tekst}
            </Badge>
            {jobb.estimatedHours != null && (
              <span className="text-[11px] text-tekst-svakest">
                {timer(jobb.estimatedHours)}
              </span>
            )}
          </div>

          {jobb.assignedTo && (
            <p className="mt-1 truncate text-[11px] text-tekst-svak">{jobb.assignedTo}</p>
          )}

          {/* Alternativ til dra-og-slipp, særlig for nettbrett */}
          <label className="mt-1.5 block">
            <span className="sr-only">Flytt {jobb.title} til annen dag</span>
            <select
              value={dager.find((d) => d.jobber.some((j) => j.id === jobb.id))?.iso ?? ""}
              disabled={venter}
              onChange={(e) => flytt(jobb.id, e.target.value || null)}
              className="w-full rounded border-0 bg-flate-hover px-1.5 py-1 text-[11px] text-tekst-svak ring-1 ring-kant ring-inset focus:ring-2 focus:ring-merke-600 focus:outline-none"
            >
              {valg.map((v) => (
                <option key={v.verdi} value={v.verdi}>{v.tekst}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </li>
  );
}

function Kolonne({
  nokkel,
  tittel,
  undertittel,
  jobber,
  fremhev,
  tom,
  styring,
}: {
  nokkel: string;
  tittel: string;
  undertittel?: string;
  jobber: Jobb[];
  fremhev?: boolean;
  tom: string;
  styring: Tavlestyring;
}) {
  const { over, settOver, drar, settDrar, flytt } = styring;
  const sumTimer = jobber.reduce((s, j) => s + (j.estimatedHours ?? 0), 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        settOver(nokkel);
      }}
      onDragLeave={() => settOver((f) => (f === nokkel ? null : f))}
      onDrop={(e) => {
        e.preventDefault();
        settOver(null);
        if (drar) flytt(drar, nokkel === "uplanlagt" ? null : nokkel);
        settDrar(null);
      }}
      className={`flex min-w-56 flex-1 flex-col rounded-xl border p-2 transition-colors ${
        over === nokkel
          ? "border-merke-500 bg-merke-50"
          : fremhev
            ? "border-merke-200 bg-flate"
            : "border-kant bg-flate-dempet/60"
      }`}
    >
      <div className="mb-2 px-1">
        <p
          className={`text-sm font-semibold ${fremhev ? "text-aksent" : "text-tekst"}`}
        >
          {tittel}
        </p>
        <p className="text-xs text-tekst-svak">
          {undertittel}
          {jobber.length > 0 && ` · ${jobber.length} jobb${jobber.length === 1 ? "" : "er"}`}
          {sumTimer > 0 && ` · ${timer(sumTimer)}`}
        </p>
      </div>

      {jobber.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-tekst-svakest">{tom}</p>
      ) : (
        <ul className="space-y-2">
          {jobber.map((j) => (
            <Kort key={j.id} jobb={j} styring={styring} />
          ))}
        </ul>
      )}
    </div>
  );
}
