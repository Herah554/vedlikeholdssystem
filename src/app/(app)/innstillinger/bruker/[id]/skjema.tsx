"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, KeyRound, Save } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { ROLLE, ROLLE_BESKRIVELSE } from "@/lib/domene";
import type { Role } from "@/generated/prisma/client";
import type { Resultat } from "../../actions";

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

export function RedigerBrukerSkjema({
  lagre,
  bruker,
}: {
  lagre: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  bruker: {
    name: string;
    email: string;
    role: Role;
    phone: string | null;
    hourlyRate: string | null;
    dailyHours: number;
  };
}) {
  const [state, action] = useActionState(lagre, { ok: true });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Navn" required>
          <Input name="name" defaultValue={bruker.name} required />
        </Field>
        <Field label="E-post" required hint="Brukes til innlogging">
          <Input name="email" type="email" defaultValue={bruker.email} required />
        </Field>
      </div>

      <Field label="Rolle" required hint={ROLLE_BESKRIVELSE[bruker.role]}>
        <Select name="role" defaultValue={bruker.role} required>
          {Object.entries(ROLLE).map(([verdi, tekst]) => (
            <option key={verdi} value={verdi}>{tekst}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <Input name="phone" defaultValue={bruker.phone ?? ""} placeholder="900 00 000" />
        </Field>
        <Field label="Timepris (kr)" hint="La stå tom for å bruke firmaets sats">
          <Input
            name="hourlyRate"
            type="number"
            min="0"
            step="10"
            defaultValue={bruker.hourlyRate ?? ""}
          />
        </Field>
      </div>

      <Field
        label="Timer per dag"
        required
        hint="Ukeplanen bruker den til å vise hvor mye som er igjen. Deltid og skift settes her."
      >
        <Input
          name="dailyHours"
          type="number"
          min="0"
          max="24"
          step="0.5"
          defaultValue={bruker.dailyHours}
          required
        />
      </Field>

      <Tilbakemelding state={state} />
      <Lagre tekst="Lagre endringer" ikon={<Save className="size-4" aria-hidden />} />
    </form>
  );
}

export function PassordSkjema({
  nullstill,
  navn,
}: {
  nullstill: (forrige: Resultat, data: FormData) => Promise<Resultat>;
  navn: string;
}) {
  const [state, action] = useActionState(nullstill, { ok: true });

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Nytt passord"
        required
        hint={`Minst åtte tegn. Gi det til ${navn} på en trygg måte, og be hen bytte det.`}
      >
        <Input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Tilbakemelding state={state} />
      <Lagre tekst="Sett nytt passord" ikon={<KeyRound className="size-4" aria-hidden />} />
    </form>
  );
}
