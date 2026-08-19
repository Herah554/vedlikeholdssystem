"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, RotateCcw, Save } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { ROLLE } from "@/lib/domene";
import {
  MODULER,
  VALGBARE_ROLLER,
  type Matrise,
  type Nivaa,
} from "@/lib/rettigheter";
import { lagreRettigheter, tilbakestillRettigheter, type Resultat } from "./actions";

function LagreKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Lagre rettigheter"}
    </Button>
  );
}

/** Nivåene som gir mening for én modul. Ikke alle har et «endre»-trinn. */
function nivaerFor(modul: (typeof MODULER)[number]): Nivaa[] {
  const ut: Nivaa[] = ["se"];
  if (modul.endre) ut.push("endre");
  if (modul.administrere) ut.push("administrere");
  return ut;
}

const NIVAA_TEKST: Record<Nivaa, string> = {
  se: "Se",
  endre: "Endre",
  administrere: "Administrere",
};

export function RettighetsMatrise({ matrise }: { matrise: Matrise }) {
  const [state, action] = useActionState<Resultat, FormData>(lagreRettigheter, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-4">
      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      {state.melding && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.melding}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-kant">
              <th className="px-3 py-2 text-left font-medium text-tekst-svak">
                Modul
              </th>
              {VALGBARE_ROLLER.map((rolle) => (
                <th
                  key={rolle}
                  className="px-3 py-2 text-left font-medium text-tekst-svak"
                >
                  {ROLLE[rolle]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-kant">
            {MODULER.map((modul) => (
              <tr key={modul.id}>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-tekst">{modul.navn}</span>
                </td>
                {VALGBARE_ROLLER.map((rolle) => (
                  <td key={rolle} className="px-3 py-2.5">
                    <Select
                      name={`${rolle}:${modul.id}`}
                      defaultValue={matrise[rolle]?.[modul.id] ?? "ingen"}
                      aria-label={`${ROLLE[rolle]} — ${modul.navn}`}
                      className="w-auto py-1 text-xs"
                    >
                      <option value="ingen">Ingen tilgang</option>
                      {nivaerFor(modul).map((n) => (
                        <option key={n} value={n}>
                          {NIVAA_TEKST[n]}
                        </option>
                      ))}
                    </Select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LagreKnapp />
        <Button
          type="submit"
          variant="stille"
          formAction={tilbakestillRettigheter}
        >
          <RotateCcw className="size-4" aria-hidden />
          Tilbakestill
        </Button>
      </div>
    </form>
  );
}
