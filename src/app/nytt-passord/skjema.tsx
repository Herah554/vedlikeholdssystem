"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { lagreNyttPassord, type Resultat } from "./actions";

function LagreKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <KeyRound className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Sett nytt passord"}
    </Button>
  );
}

export function NyttPassordSkjema({ token }: { token: string }) {
  const [state, action] = useActionState<Resultat, FormData>(
    lagreNyttPassord,
    { ok: false },
  );

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-tekst">Passordet er byttet</p>
            <p className="mt-1 text-tekst-svak">
              Alle andre innlogginger på kontoen din er avsluttet. Var det noen
              andre som hadde kommet seg inn, er de nå ute.
            </p>
          </div>
        </div>

        <Link
          href="/logg-inn"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-merke-600 px-3 py-2 text-sm font-medium text-white hover:bg-merke-700"
        >
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      <Field label="Nytt passord" required hint="Minst åtte tegn">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
        />
      </Field>

      <Field label="Gjenta passordet" required>
        <Input
          name="password2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <LagreKnapp />
    </form>
  );
}
