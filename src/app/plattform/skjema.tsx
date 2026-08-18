"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Building2, CheckCircle2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { opprettKunde, type Resultat } from "./actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Building2 className="size-4" aria-hidden />
      {pending ? "Oppretter …" : "Opprett kunde"}
    </Button>
  );
}

export function NyKundeSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(opprettKunde, {
    ok: true,
  });
  const skjema = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={skjema}
      action={async (data) => {
        await action(data);
      }}
      key={state.melding ?? "tomt"}
      className="space-y-4"
    >
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firmanavn" required>
          <Input
            name="firma"
            required
            defaultValue={state.verdier?.firma}
            placeholder="Fjordkraft Vedlikehold AS"
          />
        </Field>

        <Field label="Organisasjonsnummer">
          <Input
            name="orgNumber"
            defaultValue={state.verdier?.orgNumber}
            placeholder="912345678"
          />
        </Field>
      </div>

      <div className="border-t border-kant pt-4">
        <p className="mb-1 text-sm font-medium text-tekst">
          Deres første administrator
        </p>
        <p className="mb-3 text-sm text-tekst-svak">
          Denne kontoen kan opprette resten av brukerne selv. Passordet setter
          du nå og gir videre — det finnes ingen e-postutsending ennå.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Navn" required>
            <Input
              name="navn"
              required
              defaultValue={state.verdier?.navn}
              placeholder="Kari Nordmann"
            />
          </Field>

          <Field label="E-post" required hint="Brukes til innlogging">
            <Input
              name="email"
              type="email"
              required
              defaultValue={state.verdier?.email}
              placeholder="kari@kunde.no"
            />
          </Field>

          <Field label="Midlertidig passord" required hint="Minst åtte tegn">
            <Input
              name="password"
              type="text"
              required
              minLength={8}
              autoComplete="off"
            />
          </Field>
        </div>
      </div>

      <SendKnapp />
    </form>
  );
}
