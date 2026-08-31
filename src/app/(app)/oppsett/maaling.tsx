"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Scale } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { settPersonMaling } from "./actions";
import type { PersonMaling } from "@/generated/prisma/client";

/**
 * Hvor langt måling av enkeltpersoner får gå.
 *
 * Tre valg og ikke en av/på-bryter. Skillet som betyr noe går ikke mellom å
 * måle og ikke måle, men mellom å se sine egne tall og at andre ser dem:
 * egne tall om eget arbeid er tilbakemelding, mens en oversikt over kolleger
 * er et kontrolltiltak etter arbeidsmiljøloven kapittel 9.
 *
 * Standarden er «Egne tall». Et system som slår på måling av kolleger uten
 * at noen har tatt stilling til det, tar en avgjørelse som hører hjemme hos
 * arbeidsgiveren.
 */

const VALG: {
  verdi: PersonMaling;
  navn: string;
  hva: string;
  folge: string;
}[] = [
  {
    verdi: "AV",
    navn: "Av",
    hva: "Ingen ser tall om enkeltpersoner — verken sine egne eller andres.",
    folge: "Rapportene viser bare tall for anlegget og driften.",
  },
  {
    verdi: "EGNE",
    navn: "Egne tall",
    hva: "Hver enkelt ser sitt eget arbeid. Ingen ser andres.",
    folge:
      "Den som ser at hen mangler dokumentasjon på halvparten av jobbene, " +
      "retter det selv. Dette er tilbakemelding, ikke kontroll.",
  },
  {
    verdi: "ALLE",
    navn: "Hele laget",
    hva: "De som leder arbeidet ser oversikten over alle. Hver enkelt ser fortsatt sine egne.",
    folge:
      "Dette er et kontrolltiltak. Arbeidsmiljøloven kapittel 9 krever at " +
      "det drøftes med tillitsvalgte, at de ansatte får vite om det, og at " +
      "dere vurderer jevnlig om det fortsatt er nødvendig.",
  },
];

export function Maaling({ naavaerende }: { naavaerende: PersonMaling }) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const [lagret, settLagret] = useState(false);
  const router = useRouter();

  function velg(verdi: PersonMaling) {
    if (verdi === naavaerende) return;
    settFeil(undefined);
    settLagret(false);
    start(async () => {
      const svar = await settPersonMaling(verdi);
      if (svar.ok) {
        settLagret(true);
        router.refresh();
      } else {
        settFeil(svar.feil);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Scale className="size-4 text-tekst-svak" aria-hidden />
            Måling av enkeltpersoner
          </span>
        }
        description="Hvor langt tallene om den enkelte får gå"
      />
      <CardBody>
        <ul className="space-y-2">
          {VALG.map((v) => {
            const valgt = v.verdi === naavaerende;
            return (
              <li key={v.verdi}>
                <button
                  type="button"
                  onClick={() => velg(v.verdi)}
                  disabled={venter}
                  aria-pressed={valgt}
                  className={`w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${
                    valgt
                      ? "border-merke-500 bg-merke-50 dark:border-merke-500/50 dark:bg-merke-500/10"
                      : "border-kant hover:bg-flate-hover"
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        valgt
                          ? "border-merke-600 bg-merke-600 text-white"
                          : "border-kant-sterk"
                      }`}
                      aria-hidden
                    >
                      {valgt && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-tekst">
                        {v.navn}
                      </span>
                      <span className="mt-0.5 block text-sm text-tekst-svak">
                        {v.hva}
                      </span>
                      <span
                        className={`mt-1 block text-xs ${
                          v.verdi === "ALLE"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-tekst-svakest"
                        }`}
                      >
                        {v.folge}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {feil && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {feil}
          </p>
        )}
        {lagret && !feil && (
          <p
            aria-live="polite"
            className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <Check className="size-4 shrink-0" aria-hidden />
            Lagret.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
