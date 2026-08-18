"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Plus, Save } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { opprettLeverandor, type Resultat } from "./actions";

function Tilbakemelding({ state }: { state: Resultat }) {
  if (state.feil) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.feil}
      </p>
    );
  }
  if (state.melding) {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
        <Check className="size-4 shrink-0" aria-hidden />
        {state.melding}
      </p>
    );
  }
  return null;
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

type Verdier = {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

function Felter({ v }: { v: Verdier }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firmanavn" required>
          <Input name="name" defaultValue={v.name ?? ""} required placeholder="Ahlsell Norge AS" />
        </Field>
        <Field label="Kontaktperson">
          <Input
            name="contactName"
            defaultValue={v.contactName ?? ""}
            placeholder="Kari Hansen"
          />
        </Field>
      </div>

      <Field
        label="E-post"
        hint="Hit sendes bestillingene. Uten adresse kan du fortsatt lage bestillingen, men ikke sende den herfra."
      >
        <Input
          name="email"
          type="email"
          defaultValue={v.email ?? ""}
          placeholder="ordre@leverandor.no"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <Input name="phone" defaultValue={v.phone ?? ""} placeholder="51 81 85 00" />
        </Field>
        <Field label="Nettside">
          <Input
            name="website"
            defaultValue={v.website ?? ""}
            placeholder="https://www.leverandor.no"
          />
        </Field>
      </div>
    </>
  );
}

export function NyLeverandorSkjema() {
  const [state, action] = useActionState<Resultat, FormData>(opprettLeverandor, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-4">
      <Felter v={{}} />
      <Tilbakemelding state={state} />
      <Lagre tekst="Legg til leverandør" ikon={<Plus className="size-4" aria-hidden />} />
    </form>
  );
}

export function RedigerLeverandorSkjema({
  lagre,
  verdier,
}: {
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  verdier: Verdier;
}) {
  const [state, action] = useActionState(lagre, { ok: true });

  return (
    <form action={action} className="space-y-4">
      <Felter v={verdier} />
      <Tilbakemelding state={state} />
      <Lagre tekst="Lagre endringer" ikon={<Save className="size-4" aria-hidden />} />
    </form>
  );
}
