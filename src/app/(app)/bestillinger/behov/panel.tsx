"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Link2,
  PackageSearch,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, Textarea } from "@/components/ui";
import { DeleSok } from "@/components/delesok";
import { kroner, relativTid, tall } from "@/lib/format";
import {
  avvisBehov,
  bestillBehov,
  koblePartTilBehov,
  sokDeler,
  type Deletreff,
} from "@/app/(app)/reservedeler/behov-actions";

/**
 * Arbeidslista til den som bestiller deler.
 *
 * Alt teknikerne mangler, samlet ett sted, gruppert slik bestillingen faktisk
 * blir: én per leverandør. Behov for samme del slås sammen til én linje —
 * det skjer på serveren, men vises her, så ingen trenger å stole på at
 * systemet gjør det riktige uten å se det.
 *
 * De to bunkene som ikke kan bestilles står nederst, men de står der. Et
 * behov som mangler leverandør eller delenummer er ikke ferdigbehandlet, og
 * skjuler man det, tror teknikeren at hen er glemt — noe hen da også er.
 */

export type BehovRad = {
  id: string;
  quantity: number;
  urgent: boolean;
  note: string | null;
  description: string | null;
  meldtAv: string;
  meldt: string;
  del: {
    id: string;
    nummer: string;
    navn: string;
    enhet: string;
    beholdning: number;
    pris: number;
  } | null;
  ordre: { id: string; nummer: string; tittel: string } | null;
};

export type Gruppe = {
  supplierId: string;
  navn: string;
  behov: BehovRad[];
};

export function BehovsPanel({
  klare,
  utenLeverandor,
  maaKobles,
  kanKoble,
  kanBestille,
}: {
  klare: Gruppe[];
  utenLeverandor: BehovRad[];
  maaKobles: BehovRad[];
  kanKoble: boolean;
  /** Uten dette ville knappene vært synlige for alle og feilet på serveren. */
  kanBestille: boolean;
}) {
  const [valgte, settValgte] = useState<Set<string>>(
    () => new Set(klare.flatMap((g) => g.behov.map((b) => b.id))),
  );
  const [venter, start] = useTransition();
  const [jobber, settJobber] = useState<string>();
  const [svar, settSvar] = useState<{ ok: boolean; melding?: string; feil?: string }>();
  const router = useRouter();

  function veksle(id: string) {
    settValgte((f) => {
      const ny = new Set(f);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
    settSvar(undefined);
  }

  function bestill(ider: string[], merkelapp: string) {
    settJobber(merkelapp);
    settSvar(undefined);
    start(async () => {
      const res = await bestillBehov(ider);
      settSvar(res);
      settJobber(undefined);
      if (res.ok) router.refresh();
    });
  }

  const alleValgte = klare
    .flatMap((g) => g.behov)
    .filter((b) => valgte.has(b.id))
    .map((b) => b.id);

  return (
    <div className="space-y-4">
      {svar && (
        <p
          role={svar.ok ? undefined : "alert"}
          className={
            svar.ok
              ? "flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300"
          }
        >
          {svar.ok ? (
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          {svar.melding ?? svar.feil}
        </p>
      )}

      {kanBestille && klare.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kant bg-flate-dempet px-4 py-3">
          <p className="text-sm text-tekst-svak">
            {alleValgte.length} valgt fra {klare.length} leverandører
          </p>
          <Button
            onClick={() => bestill(alleValgte, "alle")}
            disabled={venter || alleValgte.length === 0}
          >
            <ShoppingCart className="size-4" aria-hidden />
            {jobber === "alle" ? "Bestiller …" : "Bestill alt valgt"}
          </Button>
        </div>
      )}

      {klare.map((g) => {
        const valgtHer = g.behov.filter((b) => valgte.has(b.id)).map((b) => b.id);
        const sum = g.behov
          .filter((b) => valgte.has(b.id))
          .reduce((s, b) => s + b.quantity * (b.del?.pris ?? 0), 0);

        return (
          <Card key={g.supplierId}>
            <CardHeader
              title={g.navn}
              action={
                <div className="flex items-center gap-3">
                  <span className="text-sm text-tekst-svak tabular-nums">
                    {kroner(sum)}
                  </span>
                  {kanBestille && <Button
                    onClick={() => bestill(valgtHer, g.supplierId)}
                    disabled={venter || valgtHer.length === 0}
                  >
                    <Truck className="size-4" aria-hidden />
                    {jobber === g.supplierId
                      ? "Bestiller …"
                      : `Bestill ${valgtHer.length}`}
                  </Button>}
                </div>
              }
            />
            <ul className="divide-y divide-kant">
              {g.behov.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    {kanBestille && (
                      <input
                        type="checkbox"
                        checked={valgte.has(b.id)}
                        onChange={() => veksle(b.id)}
                        className="mt-1 size-4 shrink-0 rounded border-kant text-aksent focus:ring-aksent/30"
                      />
                    )}
                    <Detaljer behov={b} />
                  </label>
                  {kanBestille && <Avvis id={b.id} />}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {klare.length === 0 && utenLeverandor.length === 0 && maaKobles.length === 0 && (
        <Card>
          <CardBody className="py-10 text-center">
            <PackageSearch
              className="mx-auto mb-3 size-10 text-tekst-svakest"
              aria-hidden
            />
            <p className="text-sm font-medium text-tekst">Ingen delebehov venter</p>
            <p className="mt-1 text-sm text-tekst-svak">
              Teknikerne melder behov fra arbeidsordren sin. De dukker opp her.
            </p>
          </CardBody>
        </Card>
      )}

      {maaKobles.length > 0 && (
        <Card>
          <CardHeader
            title="Må kobles til en reservedel"
            action={<Link2 className="size-4 text-tekst-svakest" aria-hidden />}
          />
          <CardBody className="border-b border-kant">
            <p className="text-sm text-tekst-svak">
              Teknikeren fant ikke delen i registeret og beskrev den med ord. Finn
              riktig delenummer, så kan behovet bestilles som alle andre.
            </p>
          </CardBody>
          <ul className="divide-y divide-kant">
            {maaKobles.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <Detaljer behov={b} />
                {kanKoble && <Kobling id={b.id} />}
                {kanBestille && <Avvis id={b.id} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {utenLeverandor.length > 0 && (
        <Card>
          <CardHeader
            title="Mangler leverandør"
            action={<Truck className="size-4 text-tekst-svakest" aria-hidden />}
          />
          <CardBody className="border-b border-kant">
            <p className="text-sm text-tekst-svak">
              Delen finnes, men ingen har satt hvem som selger den. Sett
              leverandør på reservedelen, så kan behovet bestilles.
            </p>
          </CardBody>
          <ul className="divide-y divide-kant">
            {utenLeverandor.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <Detaljer behov={b} />
                {b.del && (
                  <Link
                    href={`/reservedeler/${b.del.id}`}
                    className="mt-1.5 inline-block text-xs text-aksent hover:underline"
                  >
                    Sett leverandør på {b.del.nummer} →
                  </Link>
                )}
                {kanBestille && <Avvis id={b.id} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Detaljer({ behov: b }: { behov: BehovRad }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {b.del ? (
          <>
            <span className="font-mono text-xs text-tekst-svak">{b.del.nummer}</span>
            <span className="text-sm font-medium text-tekst">{b.del.navn}</span>
          </>
        ) : (
          <span className="text-sm font-medium text-tekst">{b.description}</span>
        )}
        <span className="text-sm text-tekst-svak tabular-nums">
          — {tall(b.quantity)} {b.del?.enhet ?? "stk"}
        </span>
        {b.urgent && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
            Haster
          </span>
        )}
      </div>

      {b.note && <p className="mt-1 text-sm text-tekst-svak">«{b.note}»</p>}

      <p className="mt-1 text-xs text-tekst-svak">
        {b.meldtAv} · {relativTid(b.meldt)}
        {b.ordre && (
          <>
            {" · "}
            <Link
              href={`/arbeidsordre/${b.ordre.id}`}
              className="text-aksent hover:underline"
            >
              {b.ordre.nummer} {b.ordre.tittel}
            </Link>
          </>
        )}
        {b.del && b.del.beholdning > 0 && (
          <> · {tall(b.del.beholdning)} {b.del.enhet} på lager</>
        )}
      </p>
    </div>
  );
}

/** Å avvise uten begrunnelse gir teknikeren ingenting å gå videre på. */
function Avvis({ id }: { id: string }) {
  const [apen, settApen] = useState(false);
  const [grunn, settGrunn] = useState("");
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  if (!apen) {
    return (
      <button
        type="button"
        onClick={() => settApen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-tekst-svak hover:text-tekst"
      >
        <X className="size-3.5" aria-hidden />
        Avvis
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        rows={2}
        value={grunn}
        onChange={(e) => settGrunn(e.target.value)}
        placeholder="Hvorfor bestilles den ikke? Teknikeren ser dette."
      />
      {feil && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {feil}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="sekundær"
          disabled={venter}
          onClick={() =>
            start(async () => {
              const res = await avvisBehov(id, grunn);
              if (res.ok) router.refresh();
              else settFeil(res.feil);
            })
          }
        >
          {venter ? "Avviser …" : "Avvis behovet"}
        </Button>
        <Button variant="sekundær" onClick={() => settApen(false)} disabled={venter}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function Kobling({ id }: { id: string }) {
  const [valgt, settValgt] = useState<Deletreff | null>(null);
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-kant p-3">
      <DeleSok navn="partId" sok={sokDeler} label="Koble til" paavalgt={settValgt} />
      {feil && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {feil}
        </p>
      )}
      <Button
        disabled={venter || !valgt}
        onClick={() =>
          valgt &&
          start(async () => {
            const res = await koblePartTilBehov(id, valgt.id);
            if (res.ok) router.refresh();
            else settFeil(res.feil);
          })
        }
      >
        <Link2 className="size-4" aria-hidden />
        {venter ? "Kobler …" : "Koble behovet til denne delen"}
      </Button>
    </div>
  );
}
