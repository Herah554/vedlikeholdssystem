"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Power, Trash2, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader, Input } from "@/components/ui";
import { slettBedrift, type Resultat } from "../actions";

/**
 * Sletting av en kunde.
 *
 * Den eneste handlingen i systemet som ikke kan angres, og derfor den eneste
 * som er bygget for å være vanskelig å gjøre ved et uhell.
 *
 * Bedriften må deaktiveres først. Det steget er reversibelt og koster
 * ingenting, men det legger et opphold mellom «jeg vil bli kvitt denne» og at
 * den faktisk er borte. Deretter må firmanavnet skrives inn nøyaktig — en
 * avkryssingsboks krysses av uten å leses, men et navn må man se på skjermen
 * for å skrive.
 *
 * Serveren krever begge deler på nytt. Det som står her er en hjelp til å
 * gjøre riktig, ikke en sperre noen kan gå rundt.
 */
export function SlettKort({
  id,
  navn,
  aktiv,
  innhold,
  deaktiver,
}: {
  id: string;
  navn: string;
  aktiv: boolean;
  innhold: { brukere: number; anlegg: number; arbeidsordre: number; avvik: number };
  deaktiver: (data: FormData) => Promise<void>;
}) {
  const [state, action] = useActionState(slettBedrift, { ok: true } as Resultat);
  const [skrevet, settSkrevet] = useState("");
  const router = useRouter();

  // Kunden finnes ikke lenger, så denne siden gjør det heller ikke
  useEffect(() => {
    if (state.ok && state.melding) router.push("/plattform");
  }, [state, router]);

  return (
    <Card className="mt-6 border-red-200 dark:border-red-500/30">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2 text-red-800 dark:text-red-300">
            <TriangleAlert className="size-4" aria-hidden />
            Slett bedriften
          </span>
        }
      />
      <CardBody>
        <p className="text-sm text-tekst-svak">
          Alt {navn} har lagt inn blir borte for godt: {innhold.brukere}{" "}
          {innhold.brukere === 1 ? "bruker" : "brukere"}, {innhold.anlegg}{" "}
          {innhold.anlegg === 1 ? "anlegg" : "anlegg"}, {innhold.arbeidsordre}{" "}
          arbeidsordre og {innhold.avvik} avvik — sammen med timer, deler,
          bestillinger, skjemaer og vedlegg. Det finnes ingen angreknapp og
          ingen sikkerhetskopi i systemet.
        </p>

        {aktiv ? (
          <div className="mt-4 rounded-lg border border-kant bg-flate-dempet p-4">
            <p className="text-sm text-tekst">
              Bedriften er aktiv. Deaktiver den først.
            </p>
            <p className="mt-1 text-sm text-tekst-svak">
              Da stenges tilgangen med det samme, men ingenting slettes — og du
              kan slå den på igjen når som helst. Er du fortsatt sikker etterpå,
              kan du slette herfra.
            </p>
            <form action={deaktiver} className="mt-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="aktiv" value="nei" />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tekst ring-1 ring-kant-sterk ring-inset hover:bg-flate-hover"
              >
                <Power className="size-4" aria-hidden />
                Deaktiver {navn}
              </button>
            </form>
          </div>
        ) : (
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={id} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-tekst">
                Skriv «{navn}» for å bekrefte
              </span>
              <Input
                name="bekreftNavn"
                value={skrevet}
                onChange={(e) => settSkrevet(e.target.value)}
                autoComplete="off"
                placeholder={navn}
              />
            </label>

            {state.feil && (
              <p
                role="alert"
                className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {state.feil}
              </p>
            )}

            <SlettKnapp klar={skrevet.trim() === navn} navn={navn} />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function SlettKnapp({ klar, navn }: { klar: boolean; navn: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!klar || pending}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-600/40"
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? "Sletter …" : `Slett ${navn} for godt`}
    </button>
  );
}
