"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ANLEGG_TYPE, KRITIKALITET } from "@/lib/domene";
import { opprettUtstyr, type Resultat } from "../actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Opprett"}
    </Button>
  );
}

export function NyttUtstyrSkjema({
  foreldre,
  kostnadssteder,
  forvalgtForelder,
}: {
  foreldre: { id: string; etikett: string }[];
  kostnadssteder: { id: string; etikett: string }[];
  forvalgtForelder?: string;
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettUtstyr, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-4">
      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2.5 text-sm text-red-800 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="TAG" required hint="Kortkoden folk bruker til daglig, f.eks. P-101">
          <Input name="code" required maxLength={40} placeholder="P-101" className="font-mono" />
        </Field>
        <Field label="Navn" required>
          <Input name="name" required placeholder="Kjølevannspumpe 1" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="type" defaultValue="UTSTYR" required>
            {Object.entries(ANLEGG_TYPE).map(([verdi, tekst]) => (
              <option key={verdi} value={verdi}>{tekst}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ligger under" hint="La stå tom for et nytt hovedanlegg">
          <Select name="parentId" defaultValue={forvalgtForelder ?? ""}>
            <option value="">Ingen — dette er et hovedanlegg</option>
            {foreldre.map((f) => (
              <option key={f.id} value={f.id}>{f.etikett}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Kritikalitet"
        required
        hint="Hvor hardt rammes driften hvis dette står? Styrer prioritering av jobber."
      >
        <Select name="criticality" defaultValue="3" required>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} — {KRITIKALITET[n].tekst}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Beskrivelse">
        <Textarea name="description" rows={3} placeholder="Hva gjør denne enheten, og hva skjer hvis den stopper?" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produsent">
          <Input name="manufacturer" placeholder="Grundfos" />
        </Field>
        <Field label="Modell">
          <Input name="modelNumber" placeholder="NK 80-250/270" />
        </Field>
        <Field label="Serienummer">
          <Input name="serialNumber" />
        </Field>
        <Field label="Plassering">
          <Input name="location" placeholder="Pumperom, plan 1" />
        </Field>
        <Field label="Installert">
          <Input name="installedAt" type="date" />
        </Field>
        <Field label="Innkjøpspris (kr)">
          <Input name="purchaseCost" type="number" min="0" step="1000" placeholder="148000" />
        </Field>
      </div>

      {kostnadssteder.length > 0 && (
        <Field label="Kostnadssted" hint="Bestemmer hvilket budsjett kostnadene havner på">
          <Select name="costCenterId" defaultValue="">
            <option value="">Ikke valgt</option>
            {kostnadssteder.map((k) => (
              <option key={k.id} value={k.id}>{k.etikett}</option>
            ))}
          </Select>
        </Field>
      )}

      <SendKnapp />
    </form>
  );
}
