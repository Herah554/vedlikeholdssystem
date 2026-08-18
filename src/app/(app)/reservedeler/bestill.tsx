"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ShoppingCart } from "lucide-react";
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
 * Delene grupperes per leverandør på serversiden, slik at hver leverandør
 * får én samlet bestilling. Deler uten leverandør kan ikke bestilles — da
 * vet ikke systemet hvem den skal til — og vises derfor tydelig som det.
 */
export function BestillPanel({ deler }: { deler: BestillDel[] }) {
  const bestillbare = deler.filter((d) => d.leverandor);
  const [valgte, settValgte] = useState<Set<string>>(
    () => new Set(bestillbare.map((d) => d.id)),
  );
  const [venter, start] = useTransition();
  const [svar, settSvar] = useState<{ ok: boolean; melding?: string; feil?: string }>();
  const router = useRouter();

  const utenLeverandor = deler.filter((d) => !d.leverandor);

  function veksle(id: string) {
    settValgte((f) => {
      const ny = new Set(f);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
    settSvar(undefined);
  }

  function bestill() {
    start(async () => {
      const r = await lagBestillingerFraDeler([...valgte]);
      settSvar(r);
      if (r.ok) {
        settValgte(new Set());
        router.push("/bestillinger");
      }
    });
  }

  // Vis hvor mange leverandører det blir, så brukeren skjønner grupperingen
  const leverandorer = new Set(
    bestillbare.filter((d) => valgte.has(d.id)).map((d) => d.leverandor),
  );

  return (
    <div className="kort mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-tekst">
            Bestill deler under minimum
          </h2>
          <p className="mt-0.5 text-sm text-tekst-svak">
            Systemet foreslår antall opp til maksimumsnivået, og samler delene i
            én bestilling per leverandør.
          </p>
        </div>

        <Button onClick={bestill} disabled={venter || valgte.size === 0}>
          <ShoppingCart className="size-4" aria-hidden />
          {venter
            ? "Oppretter …"
            : `Lag ${leverandorer.size || 0} ${leverandorer.size === 1 ? "bestilling" : "bestillinger"}`}
        </Button>
      </div>

      <ul className="divide-y divide-kant">
        {bestillbare.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={valgte.has(d.id)}
                onChange={() => veksle(d.id)}
                className="size-4 rounded border-kant-sterk text-merke-600 focus:ring-merke-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-tekst">{d.navn}</p>
                <p className="font-mono text-xs text-tekst-svak">
                  {d.nummer} · {tall(d.beholdning)} av {tall(d.minimum)} {d.enhet}
                </p>
              </div>
              <span className="shrink-0 text-xs text-tekst-svak">{d.leverandor}</span>
            </label>
          </li>
        ))}
      </ul>

      {utenLeverandor.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
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
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {svar.feil}
        </p>
      )}
      {svar?.ok && svar.melding && (
        <p aria-live="polite" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="size-4 shrink-0" aria-hidden />
          {svar.melding}
        </p>
      )}
    </div>
  );
}
