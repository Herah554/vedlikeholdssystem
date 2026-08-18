"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ClipboardCheck, PackagePlus } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import type { Resultat } from "../actions";

function Feil({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {melding}
    </p>
  );
}

function Lagre({ tekst, ikon }: { tekst: string; ikon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {ikon}
      {pending ? "Lagrer …" : tekst}
    </Button>
  );
}

export function InnkjopSkjema({
  registrer,
  enhet,
}: {
  registrer: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  enhet: string;
}) {
  const [state, action] = useActionState(registrer, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Antall (${enhet})`} required>
          <Input name="quantity" type="number" min="1" step="1" required placeholder="10" />
        </Field>
        <Field label="Pris per enhet" hint="La stå tom for uendret">
          <Input name="unitCost" type="number" min="0" step="0.01" placeholder="289" />
        </Field>
      </div>
      <Field label="Notat">
        <Input name="note" placeholder="Bestillingsnummer eller leveranse" />
      </Field>
      <Feil melding={state.feil} />
      <Lagre tekst="Registrer mottak" ikon={<PackagePlus className="size-4" aria-hidden />} />
    </form>
  );
}

export function OpptellingSkjema({
  juster,
  beholdning,
  enhet,
}: {
  juster: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  beholdning: number;
  enhet: string;
}) {
  const [state, action] = useActionState(juster, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <Field
        label={`Faktisk antall (${enhet})`}
        required
        hint={`Systemet tror det ligger ${beholdning} ${enhet} på hylla.`}
      >
        <Input
          name="talt"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={beholdning}
        />
      </Field>
      <Field label="Årsak">
        <Input name="note" placeholder="F.eks. svinn, feilføring, funnet igjen" />
      </Field>
      <Feil melding={state.feil} />
      <Lagre tekst="Korriger beholdning" ikon={<ClipboardCheck className="size-4" aria-hidden />} />
    </form>
  );
}
