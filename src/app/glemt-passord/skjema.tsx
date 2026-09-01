"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Mail, MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { bestillLenke, type Resultat } from "./actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Mail className="size-4" aria-hidden />
      {pending ? "Sender …" : "Send meg en lenke"}
    </Button>
  );
}

export function GlemtSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(bestillLenke, {
    sendt: false,
  });

  if (state.sendt) {
    return (
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-tekst">Sjekk e-posten din</p>
          <p className="mt-1 text-tekst-svak">
            Finnes adressen i systemet, ligger det nå en lenke der. Den virker i
            én time.
          </p>
          <p className="mt-2 text-tekst-svak">
            Ser du ingenting? Se i søppelposten, eller spør administratoren i
            firmaet ditt om å sette et nytt passord for deg.
          </p>
        </div>
      </div>
    );
  }

  if (state.utenEpost) {
    return (
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-tekst">
            Denne serveren sender ikke e-post
          </p>
          <p className="mt-1 text-tekst-svak">
            Be administratoren i firmaet ditt om en engangslenke. De finner
            knappen under Innstillinger, på din bruker — da velger du
            passordet selv, og ingen andre får vite det.
          </p>
        </div>
      </div>
    );
  }

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

      <Field label="E-post" required>
        <Input
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="navn@firma.no"
        />
      </Field>

      <SendKnapp />
    </form>
  );
}
