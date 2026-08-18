"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { opprettDel, type Resultat } from "../actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Opprett reservedel"}
    </Button>
  );
}

export function NyDelSkjema({
  leverandorer,
}: {
  leverandorer: { id: string; navn: string }[];
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettDel, { ok: true });

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Delenummer" required hint="Deres eget nummer, brukt til å slå opp">
          <Input name="number" required maxLength={40} placeholder="LAG-6308" className="font-mono" />
        </Field>
        <Field label="Navn" required>
          <Input name="name" required placeholder="Kulelager SKF 6308-2RS" />
        </Field>
      </div>

      <Field label="Beskrivelse">
        <Textarea name="description" rows={2} placeholder="Hvor brukes den, og hva bør man vite ved bytte?" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produsent">
          <Input name="manufacturer" placeholder="SKF" />
        </Field>
        <Field label="Produsentens delenummer">
          <Input name="manufacturerPartNo" placeholder="6308-2RSH" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Enhet" required>
          <Input name="unit" defaultValue="stk" required placeholder="stk" />
        </Field>
        <Field label="Pris per enhet" required>
          <Input name="unitCost" type="number" min="0" step="0.01" defaultValue="0" required />
        </Field>
        <Field label="Startbeholdning">
          <Input name="startBeholdning" type="number" min="0" step="1" defaultValue="0" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Minimumsnivå"
          required
          hint="Under dette varsler systemet om at delen må bestilles"
        >
          <Input name="minStock" type="number" min="0" step="1" defaultValue="0" required />
        </Field>
        <Field label="Maksimumsnivå">
          <Input name="maxStock" type="number" min="0" step="1" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hylleplass">
          <Input name="binLocation" placeholder="A1-04" className="font-mono" />
        </Field>
        <Field label="Leveringstid (dager)">
          <Input name="leadTimeDays" type="number" min="0" step="1" placeholder="3" />
        </Field>
      </div>

      {leverandorer.length > 0 && (
        <Field label="Leverandør">
          <Select name="supplierId" defaultValue="">
            <option value="">Ikke valgt</option>
            {leverandorer.map((l) => (
              <option key={l.id} value={l.id}>{l.navn}</option>
            ))}
          </Select>
        </Field>
      )}

      <SendKnapp />
    </form>
  );
}
