"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Building2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { registrerBedrift, type Resultat } from "./actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Building2 className="size-4" aria-hidden />
      {pending ? "Oppretter …" : "Opprett bedrift"}
    </Button>
  );
}

export function RegistrerSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(registrerBedrift, {
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

      <Field label="Firmanavn" required>
        <Input name="firma" required autoFocus placeholder="Nordvik Industri AS" />
      </Field>

      <Field label="Organisasjonsnummer">
        <Input name="orgNumber" placeholder="912345678" />
      </Field>

      <div className="border-t border-kant pt-4">
        <p className="mb-3 text-sm font-medium text-tekst">Din administratorkonto</p>

        <div className="space-y-4">
          <Field label="Navn" required>
            <Input name="navn" required placeholder="Ola Nordmann" />
          </Field>

          <Field label="E-post" required hint="Brukes til innlogging">
            <Input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="ola@firma.no"
            />
          </Field>

          <Field label="Passord" required hint="Minst åtte tegn">
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </div>

      <SendKnapp />
    </form>
  );
}
