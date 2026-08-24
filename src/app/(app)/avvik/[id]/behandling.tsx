"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, ClipboardList, Save } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  AVVIK_ALVOR,
  AVVIK_ALVOR_REKKEFOLGE,
  AVVIK_STATUS,
} from "@/lib/domene";
import type { DeviationSeverity, DeviationStatus } from "@/generated/prisma/client";
import { lagArbeidsordre, settAvviksStatus, type Resultat } from "../actions";

function LagreKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Lagre behandling"}
    </Button>
  );
}

export function Behandling({
  avvikId,
  lagre,
  standard,
  ansvarlige,
  neste,
  harArbeidsordre,
}: {
  avvikId: string;
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  standard: {
    assignedToId: string | null;
    severity: DeviationSeverity;
    immediateAction: string | null;
    rootCause: string | null;
    correctiveAction: string | null;
    deadline: string;
  };
  ansvarlige: { id: string; name: string }[];
  neste: DeviationStatus[];
  harArbeidsordre: boolean;
}) {
  const [state, action] = useActionState<Resultat, FormData>(lagre, { ok: true });
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  function flytt(status: DeviationStatus) {
    settFeil(undefined);
    start(async () => {
      const svar = await settAvviksStatus(avvikId, status);
      if (!svar.ok) settFeil(svar.feil);
      router.refresh();
    });
  }

  function ordre() {
    settFeil(undefined);
    start(async () => {
      const svar = await lagArbeidsordre(avvikId);
      if (!svar.ok) settFeil(svar.feil);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {(state.feil || feil) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil ?? feil}</span>
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

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ansvarlig">
            <Select name="assignedToId" defaultValue={standard.assignedToId ?? ""}>
              <option value="">— ingen —</option>
              {ansvarlige.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Alvorlighet">
            <Select name="severity" defaultValue={standard.severity}>
              {AVVIK_ALVOR_REKKEFOLGE.map((a) => (
                <option key={a} value={a}>
                  {AVVIK_ALVOR[a].tekst}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Frist" hint="Når skal tiltaket være på plass">
            <Input name="deadline" type="date" defaultValue={standard.deadline} />
          </Field>
        </div>

        <Field label="Strakstiltak" hint="Hva ble gjort der og da">
          <Textarea
            name="immediateAction"
            rows={2}
            defaultValue={standard.immediateAction ?? ""}
          />
        </Field>

        <Field
          label="Årsak"
          hint="Hvorfor skjedde det egentlig? Ikke den nærmeste forklaringen, men den bakenforliggende."
        >
          <Textarea
            name="rootCause"
            rows={3}
            defaultValue={standard.rootCause ?? ""}
            placeholder="Trucken har ingen sikt mot porten, og det finnes ingen speil eller lyssignal. Dette har vært meldt før."
          />
        </Field>

        <Field
          label="Tiltak"
          hint="Hva gjør vi for at det ikke skal skje igjen"
        >
          <Textarea
            name="correctiveAction"
            rows={3}
            defaultValue={standard.correctiveAction ?? ""}
            placeholder="Montert speil ved port 2 og malt opp gangfelt. Tatt opp på HMS-møtet 12. mars."
          />
        </Field>

        <LagreKnapp />
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-kant pt-4">
        {neste.map((s) => (
          <Button
            key={s}
            type="button"
            variant={s === "AVVIST" ? "stille" : "sekundær"}
            disabled={venter}
            onClick={() => flytt(s)}
          >
            {AVVIK_STATUS[s].tekst}
          </Button>
        ))}

        {!harArbeidsordre && (
          <Button
            type="button"
            variant="stille"
            disabled={venter}
            onClick={ordre}
            title="Lager en jobb for å rette avviket"
          >
            <ClipboardList className="size-4" aria-hidden />
            Lag arbeidsordre
          </Button>
        )}
      </div>
    </div>
  );
}
