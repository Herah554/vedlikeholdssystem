"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Layers, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui";
import { tall } from "@/lib/format";
import { lagBestillingerFraDeler } from "@/app/(app)/bestillinger/actions";

export type BestillDel = {
  id: string;
  nummer: string;
  navn: string;
  enhet: string;
  beholdning: number;
  minimum: number;
  leverandor: string | null;
};

/**
 * Lager bestillinger av deler som er under minimum.
 *
 * Delene vises gruppert per leverandør, fordi det er slik bestillingen faktisk
 * blir. Før skjedde grupperingen usynlig på serveren, og brukeren måtte stole
 * på at systemet gjorde det riktige.
 *
 * «Samle til én bestilling» virker bare når leverandøren har minst to valgte
 * deler. Med bare én er det ingenting å samle, og en knapp som later som noe
 * annet skjer er verre enn ingen knapp.
 *
 * Deler uten leverandør kan ikke bestilles — da vet ikke systemet hvem den
 * skal til — og vises derfor tydelig som det.
 */
export function BestillPanel({ deler }: { deler: BestillDel[] }) {
  const bestillbare = deler.filter((d) => d.leverandor);
  const [valgte, settValgte] = useState<Set<string>>(
    () => new Set(bestillbare.map((d) => d.id)),
  );
  const [venter, start] = useTransition();
  const [jobber, settJobber] = useState<string>();
  const [svar, settSvar] = useState<{
    ok: boolean;
    melding?: string;
    feil?: string;
  }>();
  const router = useRouter();

  const utenLeverandor = deler.filter((d) => !d.leverandor);

  // Grupper per leverandør, i den rekkefølgen de dukker opp
  const grupper = new Map<string, BestillDel[]>();
  for (const d of bestillbare) {
    const navn = d.leverandor!;
    if (!grupper.has(navn)) grupper.set(navn, []);
    grupper.get(navn)!.push(d);
  }

  function veksle(id: string) {
    settValgte((f) => {
      const ny = new Set(f);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
    settSvar(undefined);
  }

  function velgHele(navn: string, deler: BestillDel[], paa: boolean) {
    settValgte((f) => {
      const ny = new Set(f);
      for (const d of deler) {
        if (paa) ny.add(d.id);
        else ny.delete(d.id);
      }
      return ny;
    });
    settSvar(undefined);
  }

  function bestill(ider: string[], merkelapp: string) {
    settJobber(merkelapp);
    start(async () => {
      const r = await lagBestillingerFraDeler(ider);
      settSvar(r);
      settJobber(undefined);
      if (r.ok) {
        settValgte((f) => {
          const ny = new Set(f);
          for (const id of ider) ny.delete(id);
          return ny;
        });
        router.push("/bestillinger");
      }
    });
  }

  const alleValgte = [...valgte];
  const leverandorerIValget = new Set(
    bestillbare.filter((d) => valgte.has(d.id)).map((d) => d.leverandor),
  );

  return (
    <div className="kort mb-4 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-tekst">
            Bestill deler under minimum
          </h2>
          <p className="mt-0.5 text-sm text-tekst-svak">
            Antallet foreslås opp til maksimumsnivået. Hver leverandør får sin
            egen bestilling — de skal ikke ha én e-post per skrue.
          </p>
        </div>

        <Button
          onClick={() => bestill(alleValgte, "alle")}
          disabled={venter || valgte.size === 0}
        >
          <ShoppingCart className="size-4" aria-hidden />
          {venter && jobber === "alle"
            ? "Oppretter …"
            : `Bestill alt valgt (${leverandorerIValget.size} ${
                leverandorerIValget.size === 1 ? "bestilling" : "bestillinger"
              })`}
        </Button>
      </div>

      <div className="space-y-4">
        {[...grupper.entries()].map(([navn, gruppe]) => {
          const valgtHer = gruppe.filter((d) => valgte.has(d.id));
          const kanSamle = valgtHer.length >= 2;
          const alleAvHuket = valgtHer.length === gruppe.length;

          return (
            <div
              key={navn}
              className="rounded-lg ring-1 ring-kant ring-inset"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-kant px-4 py-2.5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={alleAvHuket}
                    onChange={(e) => velgHele(navn, gruppe, e.target.checked)}
                    className="size-4 rounded border-kant-sterk text-merke-600 focus:ring-merke-600"
                  />
                  <span className="text-sm font-medium text-tekst">{navn}</span>
                </label>

                <span className="text-xs text-tekst-svak">
                  {valgtHer.length} av {gruppe.length} valgt
                </span>

                <span className="flex-1" />

                <Button
                  type="button"
                  variant="sekundær"
                  disabled={venter || !kanSamle}
                  onClick={() =>
                    bestill(
                      valgtHer.map((d) => d.id),
                      navn,
                    )
                  }
                  title={
                    kanSamle
                      ? `Samler ${valgtHer.length} deler i én bestilling til ${navn}`
                      : "Velg minst to deler fra denne leverandøren. Med bare én er det ingenting å samle."
                  }
                >
                  <Layers className="size-4" aria-hidden />
                  {venter && jobber === navn
                    ? "Samler …"
                    : `Samle til én bestilling`}
                </Button>
              </div>

              {!kanSamle && valgtHer.length === 1 && (
                <p className="border-b border-kant bg-flate-dempet px-4 py-2 text-xs text-tekst-svak">
                  Bare én del er valgt her. Samling krever minst to fra samme
                  leverandør — ellers er det jo bare en vanlig bestilling.
                </p>
              )}

              <ul className="divide-y divide-kant px-4">
                {gruppe.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={valgte.has(d.id)}
                        onChange={() => veksle(d.id)}
                        className="size-4 rounded border-kant-sterk text-merke-600 focus:ring-merke-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-tekst">
                          {d.navn}
                        </p>
                        <p className="font-mono text-xs text-tekst-svak">
                          {d.nummer} · {tall(d.beholdning)} av {tall(d.minimum)}{" "}
                          {d.enhet}
                        </p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {utenLeverandor.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {utenLeverandor.length}{" "}
            {utenLeverandor.length === 1 ? "del mangler" : "deler mangler"}{" "}
            leverandør og kan ikke bestilles:{" "}
            {utenLeverandor.map((d) => d.nummer).join(", ")}. Velg leverandør på
            delen først.
          </span>
        </div>
      )}

      {svar && !svar.ok && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {svar.feil}
        </p>
      )}
      {svar?.ok && svar.melding && (
        <p
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {svar.melding}
        </p>
      )}
    </div>
  );
}
