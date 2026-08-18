"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { PM_UTLOSER, PRIORITET, PRIORITET_REKKEFOLGE } from "@/lib/domene";
import { opprettPlan, type Resultat } from "../actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Opprett plan"}
    </Button>
  );
}

export function NyPlanSkjema({
  utstyr,
  brukere,
  forvalgtUtstyr,
}: {
  utstyr: { id: string; etikett: string }[];
  brukere: { id: string; name: string }[];
  forvalgtUtstyr?: string;
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettPlan, { ok: true });
  const [utloser, settUtloser] = useState<"TID" | "DRIFTSTIMER">("TID");

  return (
    <form action={action} className="space-y-4">
      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      <Field label="Navn på rutinen" required>
        <Input name="name" required placeholder="Smøring og vibrasjonsmåling P-101" />
      </Field>

      <Field label="Utstyr" required>
        <Select name="assetId" required defaultValue={forvalgtUtstyr ?? ""}>
          <option value="" disabled>Velg utstyr …</option>
          {utstyr.map((u) => (
            <option key={u.id} value={u.id}>{u.etikett}</option>
          ))}
        </Select>
      </Field>

      <Field label="Beskrivelse">
        <Textarea name="description" rows={2} placeholder="Hva skal gjøres, og hvorfor?" />
      </Field>

      <Field label="Hva utløser jobben?" required>
        <Select
          name="trigger"
          value={utloser}
          onChange={(e) => settUtloser(e.target.value as "TID" | "DRIFTSTIMER")}
          required
        >
          {Object.entries(PM_UTLOSER).map(([verdi, tekst]) => (
            <option key={verdi} value={verdi}>{tekst}</option>
          ))}
        </Select>
      </Field>

      {utloser === "TID" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Antall dager mellom hver gang" required>
            <Input name="intervalDays" type="number" min="1" step="1" defaultValue="90" required />
          </Field>
          <Field label="Første forfall" hint="La stå tom for å regne fra i dag">
            <Input name="nextDueAt" type="date" />
          </Field>
        </div>
      ) : (
        <Field
          label="Antall driftstimer mellom hver gang"
          required
          hint="Telles fra utstyrets driftstimer, som oppdateres på utstyrskortet"
        >
          <Input name="intervalHours" type="number" min="1" step="100" defaultValue="4000" required />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Varsle dager før"
          required
          hint="Hvor tidlig arbeidsordren skal lages"
        >
          <Input name="leadTimeDays" type="number" min="0" max="365" defaultValue="7" required />
        </Field>
        <Field label="Anslåtte timer">
          <Input name="estimatedHours" type="number" min="0" step="0.5" placeholder="1,5" />
        </Field>
        <Field label="Prioritet" required>
          <Select name="priority" defaultValue="NORMAL" required>
            {PRIORITET_REKKEFOLGE.map((p) => (
              <option key={p} value={p}>{PRIORITET[p].tekst}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Fast ansvarlig">
        <Select name="assignedToId" defaultValue="">
          <option value="">Ingen fast — tildeles ved planlegging</option>
          {brukere.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="Sjekkliste"
        hint="Ett punkt per linje. Punktene kopieres til hver arbeidsordre planen lager."
      >
        <Textarea
          name="checklist"
          rows={5}
          placeholder={"Mål vibrasjon før smøring\nSmør drivside og fri side\nMål vibrasjon etter\nNoter driftstimer"}
        />
      </Field>

      <SendKnapp />
    </form>
  );
}
