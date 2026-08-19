"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Plus, Power } from "lucide-react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { leggTilAarsak, settAarsakAktiv, type Resultat } from "./actions";

export type Aarsak = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

function LeggTilKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Legger til …" : "Legg til"}
    </Button>
  );
}

export function Aarsaker({ aarsaker }: { aarsaker: Aarsak[] }) {
  const [state, action] = useActionState<Resultat, FormData>(leggTilAarsak, {
    ok: true,
  });

  return (
    <div className="space-y-5">
      {aarsaker.length > 0 && (
        <ul className="divide-y divide-kant rounded-lg ring-1 ring-kant ring-inset">
          {aarsaker.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Badge className="bg-flate-dempet font-mono text-tekst ring-kant">
                {a.code}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-tekst">{a.name}</p>
                {a.description && (
                  <p className="text-sm text-tekst-svak">{a.description}</p>
                )}
              </div>

              {!a.isActive && (
                <Badge className="bg-flate-dempet text-tekst-svak ring-kant-sterk">
                  ikke i bruk
                </Badge>
              )}

              <form action={settAarsakAktiv}>
                <input type="hidden" name="id" value={a.id} />
                <input
                  type="hidden"
                  name="aktiv"
                  value={a.isActive ? "nei" : "ja"}
                />
                <Button
                  type="submit"
                  variant="stille"
                  title={
                    a.isActive
                      ? "Tas ut av lista. Gammel historikk beholder årsaken."
                      : "Gjør valgbar igjen"
                  }
                >
                  <Power className="size-4" aria-hidden />
                  {a.isActive ? "Ta ut" : "Ta inn"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 border-t border-kant pt-5">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kode" required hint="Kan ikke endres senere">
            <Input
              name="code"
              required
              placeholder="LAGERSKADE"
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Navn" required>
            <Input name="name" required placeholder="Skadet lager" />
          </Field>

          <Field label="Forklaring">
            <Input name="description" placeholder="Slitasje eller feil montering" />
          </Field>
        </div>

        <LeggTilKnapp />
      </form>
    </div>
  );
}
