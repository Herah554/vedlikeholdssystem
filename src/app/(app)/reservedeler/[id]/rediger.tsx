"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Pencil, Save, X } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { endreDel, type Resultat } from "../actions";

/**
 * Retter opplysningene på en reservedel.
 *
 * Minimums- og maksimumsnivået er det som oftest må endres. De settes når
 * delen registreres, før noen vet hvor fort den går med, og først etter et
 * halvår ser man at to på lager er for lite. Uten en vei til å rette det blir
 * «deler under minimum» en liste ingen stoler på.
 *
 * Beholdningen er ikke med. Den endres bare gjennom lagerbevegelser, slik at
 * reskontroen alltid summerer seg til det som står på hylla — skal et tall
 * korrigeres, gjøres det som en opptelling.
 */

export type Delverdier = {
  number: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  manufacturerPartNo: string | null;
  unit: string;
  unitCost: number;
  minStock: number;
  maxStock: number | null;
  binLocation: string | null;
  supplierId: string | null;
  leadTimeDays: number | null;
};

export function RedigerDel({
  partId,
  verdier,
  leverandorer,
}: {
  partId: string;
  verdier: Delverdier;
  leverandorer: { id: string; name: string }[];
}) {
  const [apen, settApen] = useState(false);
  const [state, action] = useActionState(endreDel.bind(null, partId), {
    ok: true,
  } as Resultat);

  if (!apen) {
    return (
      <Button variant="sekundær" onClick={() => settApen(true)}>
        <Pencil className="size-4" aria-hidden />
        Rediger opplysninger
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Delenummer" required>
          <Input name="number" defaultValue={verdier.number} required />
        </Field>
        <Field label="Navn" required>
          <Input name="name" defaultValue={verdier.name} required />
        </Field>
      </div>

      <Field label="Beskrivelse">
        <Textarea name="description" rows={2} defaultValue={verdier.description ?? ""} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fabrikat">
          <Input name="manufacturer" defaultValue={verdier.manufacturer ?? ""} />
        </Field>
        <Field label="Produsentens delenummer">
          <Input
            name="manufacturerPartNo"
            defaultValue={verdier.manufacturerPartNo ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Enhet" required>
          <Input name="unit" defaultValue={verdier.unit} required />
        </Field>
        <Field label="Minimum" required hint="Under dette skal det bestilles">
          <Input
            name="minStock"
            type="number"
            step="any"
            min="0"
            defaultValue={verdier.minStock}
            required
          />
        </Field>
        <Field label="Maksimum" hint="Nivået det fylles opp til">
          <Input
            name="maxStock"
            type="number"
            step="any"
            min="0"
            defaultValue={verdier.maxStock ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Pris">
          <Input
            name="unitCost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={verdier.unitCost}
          />
        </Field>
        <Field label="Hylleplass">
          <Input name="binLocation" defaultValue={verdier.binLocation ?? ""} />
        </Field>
        <Field label="Ledetid i dager">
          <Input
            name="leadTimeDays"
            type="number"
            min="0"
            defaultValue={verdier.leadTimeDays ?? ""}
          />
        </Field>
      </div>

      <Field
        label="Leverandør"
        hint="Uten leverandør kan delen ikke bestilles automatisk"
      >
        <Select name="supplierId" defaultValue={verdier.supplierId ?? ""}>
          <option value="">Ingen valgt</option>
          {leverandorer.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>

      {state.feil && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.feil}
        </p>
      )}
      {state.melding && (
        <p
          aria-live="polite"
          className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {state.melding}
        </p>
      )}

      <div className="flex gap-2">
        <Lagre />
        <Button variant="sekundær" type="button" onClick={() => settApen(false)}>
          <X className="size-4" aria-hidden />
          Lukk
        </Button>
      </div>
    </form>
  );
}

function Lagre() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Lagre endringer"}
    </Button>
  );
}
