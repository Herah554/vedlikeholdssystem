"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ORDRE_TYPE, PRIORITET, PRIORITET_REKKEFOLGE } from "@/lib/domene";
import { opprettOrdre, type Resultat } from "../actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Oppretter …" : "Opprett arbeidsordre"}
    </Button>
  );
}

export function NyOrdreSkjema({
  utstyr,
  brukere,
  forvalgtUtstyr,
}: {
  utstyr: { id: string; etikett: string }[];
  brukere: { id: string; name: string }[];
  forvalgtUtstyr?: string;
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettOrdre, {
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

      <Field label="Hva er problemet?" required>
        <Input
          name="title"
          required
          autoFocus
          maxLength={200}
          placeholder="F.eks. Unormal lyd fra kjølevannspumpe P-101"
        />
      </Field>

      <Field
        label="Beskrivelse"
        hint="Ta med symptomer, målinger og når det startet. Jo mer konkret, desto lettere finner andre saken igjen senere."
      >
        <Textarea
          name="description"
          rows={5}
          placeholder="Operatør meldte om kraftig vibrasjon under morgenskiftet. Vibrasjonsmåling viste 11,2 mm/s mot normalt 2,8 mm/s."
        />
      </Field>

      <Field label="Utstyr" hint="La stå tom hvis jobben ikke gjelder en bestemt maskin">
        <Select name="assetId" defaultValue={forvalgtUtstyr ?? ""}>
          <option value="">Ikke knyttet til utstyr</option>
          {utstyr.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etikett}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="type" defaultValue="KORREKTIV" required>
            {Object.entries(ORDRE_TYPE).map(([verdi, e]) => (
              <option key={verdi} value={verdi}>{e.tekst}</option>
            ))}
          </Select>
        </Field>

        <Field label="Prioritet" required>
          <Select name="priority" defaultValue="NORMAL" required>
            {PRIORITET_REKKEFOLGE.map((p) => (
              <option key={p} value={p}>{PRIORITET[p].tekst}</option>
            ))}
          </Select>
        </Field>

        <Field label="Tildel til">
          <Select name="assignedToId" defaultValue="">
            <option value="">Ikke tildelt ennå</option>
            {brukere.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Anslåtte timer">
          <Input name="estimatedHours" type="number" step="0.5" min="0" placeholder="2" />
        </Field>

        <Field label="Frist">
          <Input name="dueDate" type="date" />
        </Field>

        <Field label="Planlagt dato" hint="Dagen jobben skal gjøres">
          <Input name="plannedDate" type="date" />
        </Field>
      </div>

      <SendKnapp />
    </form>
  );
}
