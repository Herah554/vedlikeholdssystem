"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import type { Resultat } from "./actions";
import { genererForfalteOrdrer, markerPlanUtfort, settPlanAktiv } from "./actions";

/** Lager arbeidsordre av alle planer som nærmer seg forfall. */
export function GenererKnapp() {
  const [venter, start] = useTransition();
  const [svar, settSvar] = useState<Resultat>();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={venter}
        onClick={() =>
          start(async () => {
            settSvar(await genererForfalteOrdrer());
            router.refresh();
          })
        }
      >
        <RefreshCw className={`size-4 ${venter ? "animate-spin" : ""}`} aria-hidden />
        {venter ? "Lager ordre …" : "Opprett forfalte jobber"}
      </Button>

      {svar && (
        <span
          aria-live="polite"
          className={`text-sm ${svar.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {svar.melding ?? svar.feil}
        </span>
      )}
    </div>
  );
}

export function UtfortKnapp({ planId }: { planId: string }) {
  const [venter, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="sekundær"
      disabled={venter}
      onClick={() =>
        start(async () => {
          await markerPlanUtfort(planId);
          router.refresh();
        })
      }
    >
      <Check className="size-4" aria-hidden />
      Utført nå
    </Button>
  );
}

export function AktivBryter({
  planId,
  aktiv,
}: {
  planId: string;
  aktiv: boolean;
}) {
  const [venter, start] = useTransition();
  const router = useRouter();

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={aktiv}
        disabled={venter}
        onChange={(e) =>
          start(async () => {
            await settPlanAktiv(planId, e.target.checked);
            router.refresh();
          })
        }
        className="size-4 rounded border-slate-300 text-merke-600 focus:ring-merke-600"
      />
      Aktiv
    </label>
  );
}
