"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Lock, Plus, Power } from "lucide-react";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import { TONER, TONE_IDER, type Listeverdi } from "@/lib/lister";
import {
  leggTilListeverdi,
  settListeverdiAktiv,
  type Resultat,
} from "./actions";

function LeggTilKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Legger til …" : "Legg til"}
    </Button>
  );
}

export function Verdiliste({
  liste,
  verdier,
}: {
  liste: string;
  verdier: Listeverdi[];
}) {
  const [state, action] = useActionState<Resultat, FormData>(
    leggTilListeverdi,
    { ok: true },
  );

  return (
    <div className="space-y-5">
      {verdier.length > 0 && (
        <ul className="divide-y divide-kant rounded-lg ring-1 ring-kant ring-inset">
          {verdier.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Badge className={(TONER[v.tone] ?? TONER.noytral).klasse}>
                {v.name}
              </Badge>

              <span className="font-mono text-xs text-tekst-svakest">
                {v.code}
              </span>

              <div className="min-w-0 flex-1">
                {v.description && (
                  <p className="truncate text-sm text-tekst-svak">
                    {v.description}
                  </p>
                )}
              </div>

              {!v.isActive && (
                <Badge className="bg-flate-dempet text-tekst-svak ring-kant-sterk">
                  ikke i bruk
                </Badge>
              )}

              {v.isBuiltIn ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs text-tekst-svakest"
                  title="Systemet bruker denne selv når det lager ordre fra forebyggende planer"
                >
                  <Lock className="size-3.5" aria-hidden />
                  innebygd
                </span>
              ) : (
                <form action={settListeverdiAktiv}>
                  <input type="hidden" name="id" value={v.id} />
                  <input
                    type="hidden"
                    name="aktiv"
                    value={v.isActive ? "nei" : "ja"}
                  />
                  <Button
                    type="submit"
                    variant="stille"
                    title={
                      v.isActive
                        ? "Tas ut av lista. Gamle rader beholder verdien."
                        : "Gjør valgbar igjen"
                    }
                  >
                    <Power className="size-4" aria-hidden />
                    {v.isActive ? "Ta ut" : "Ta inn"}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 border-t border-kant pt-5">
        <input type="hidden" name="liste" value={liste} />

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

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Kode" required hint="Kan ikke endres">
            <Input
              name="code"
              required
              placeholder="GARANTI"
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Navn" required>
            <Input name="name" required placeholder="Garantiarbeid" />
          </Field>

          <Field label="Forklaring">
            <Input name="description" placeholder="Dekkes av leverandøren" />
          </Field>

          <Field label="Farge">
            <Select name="tone" defaultValue="noytral">
              {TONE_IDER.map((t) => (
                <option key={t} value={t}>
                  {TONER[t].navn}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <LeggTilKnapp />
      </form>
    </div>
  );
}
