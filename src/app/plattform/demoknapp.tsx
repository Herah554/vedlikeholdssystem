"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { lagDemobedrift } from "./actions";

/**
 * Lager en demobedrift med ett trykk.
 *
 * Passordet vises bare denne ene gangen. Det finnes ikke lagret noe sted i
 * klartekst, så meldingen blir stående til siden lastes på nytt.
 */
export function DemoKnapp() {
  const [venter, start] = useTransition();
  const [melding, settMelding] = useState<string>();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  function lag() {
    settFeil(undefined);
    settMelding(undefined);
    start(async () => {
      try {
        const svar = await lagDemobedrift();
        if (svar.ok) {
          settMelding(svar.melding);
          router.refresh();
        } else {
          settFeil(svar.feil);
        }
      } catch {
        settFeil("Klarte ikke å opprette demobedriften. Prøv igjen.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{feil}</span>
        </div>
      )}

      {melding && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30"
        >
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {melding}
            <span className="mt-1 block font-medium">
              Skriv det ned nå — passordet kan ikke hentes fram igjen.
            </span>
          </span>
        </div>
      )}

      <Button type="button" variant="sekundær" onClick={lag} disabled={venter}>
        <Sparkles className="size-4" aria-hidden />
        {venter ? "Bygger demobedrift …" : "Opprett demobedrift"}
      </Button>

      <p className="text-sm text-tekst-svak">
        Et anlegg med utstyr, deler, jobber i alle statuser, forfalt
        forebyggende vedlikehold og brukere i hver rolle. Bruk den til å vise
        fram systemet uten å røre en ekte kunde.
      </p>
    </div>
  );
}
