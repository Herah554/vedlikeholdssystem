"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, Plus, X } from "lucide-react";
import { Button, EmptyState, Input } from "@/components/ui";
import {
  leggTilHurtiglenke,
  slettHurtiglenke,
  type Resultat,
} from "./hurtiglenker-actions";

/**
 * Snarveiene den enkelte legger inn selv.
 *
 * Lenkene er personlige og gir ingen tilgang til noe — de er bokmerker.
 * Adressen kontrolleres på serveren i src/lib/lenker.ts, siden dette er det
 * ene stedet der én bruker skriver inn noe andre kan komme til å klikke på.
 *
 * Eksterne lenker åpnes i ny fane med rel="noreferrer": uten den kan sida man
 * går til lese hvor man kom fra, og med target="_blank" alene kan den også
 * styre fanen man forlot.
 */

export type Hurtiglenke = { id: string; label: string; url: string };

export function Hurtiglenker({ lenker }: { lenker: Hurtiglenke[] }) {
  const [state, action] = useActionState(leggTilHurtiglenke, { ok: true } as Resultat);
  const [apen, settApen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {lenker.length === 0 && !apen ? (
        <EmptyState
          title="Ingen snarveier ennå"
          description="Legg inn adresser du bruker ofte — leverandørkatalogen, driftsinstrukser, en maskinside."
          action={
            <Button variant="sekundær" onClick={() => settApen(true)}>
              <Plus className="size-4" aria-hidden />
              Legg til
            </Button>
          }
        />
      ) : (
        <>
          <ul className="min-h-0 flex-1 divide-y divide-kant overflow-auto">
            {lenker.map((l) => (
              <Rad key={l.id} lenke={l} etterSletting={() => router.refresh()} />
            ))}
          </ul>

          {!apen && (
            <div className="border-t border-kant px-5 py-2.5">
              <button
                type="button"
                onClick={() => settApen(true)}
                className="inline-flex items-center gap-1.5 text-sm text-aksent hover:underline"
              >
                <Plus className="size-3.5" aria-hidden />
                Legg til snarvei
              </button>
            </div>
          )}
        </>
      )}

      {apen && (
        <form
          action={action}
          // Ny nøkkel etter vellykket lagring tømmer feltene
          key={state.ok && !state.feil ? "tom" : "feil"}
          className="space-y-2 border-t border-kant px-5 py-3"
        >
          <Input name="label" placeholder="Navn, f.eks. «Katalog Industrideler»" required />
          <Input name="url" placeholder="idvest.no eller /reservedeler" required />
          {state.feil && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {state.feil}
            </p>
          )}
          <div className="flex gap-2">
            <Lagre />
            <Button variant="sekundær" type="button" onClick={() => settApen(false)}>
              Ferdig
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Lagre() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Lagrer …" : "Legg til"}
    </Button>
  );
}

function Rad({
  lenke,
  etterSletting,
}: {
  lenke: Hurtiglenke;
  etterSletting: () => void;
}) {
  const [venter, start] = useTransition();
  const ekstern = !lenke.url.startsWith("/");

  return (
    <li className="flex items-center gap-2 px-5 py-2.5 hover:bg-flate-hover">
      <a
        href={lenke.url}
        target={ekstern ? "_blank" : undefined}
        rel={ekstern ? "noreferrer" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm text-tekst hover:text-aksent"
      >
        <span className="truncate font-medium">{lenke.label}</span>
        {ekstern && (
          <ExternalLink className="size-3.5 shrink-0 text-tekst-svakest" aria-hidden />
        )}
      </a>
      <button
        type="button"
        disabled={venter}
        onClick={() =>
          start(async () => {
            await slettHurtiglenke(lenke.id);
            etterSletting();
          })
        }
        className="shrink-0 rounded p-1 text-tekst-svakest hover:bg-flate hover:text-tekst disabled:opacity-50"
        aria-label={`Fjern ${lenke.label}`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
