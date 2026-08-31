"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Pencil, Save, X } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { PRIORITET } from "@/lib/domene";
import { endreOrdre, type Resultat } from "../actions";

/**
 * Retter opplysningene på en arbeidsordre.
 *
 * Det som meldes inn i farten er sjelden helt riktig: feil maskin, en tittel
 * som ikke sier noe, en frist ingen satte. Uten en vei til å rette det blir
 * historikken full av ordrer ingen finner igjen når de leter etter samme feil
 * neste år.
 *
 * Status er ikke med. Den har sin egen flyt med egne regler, og å kunne hoppe
 * rett til «Lukket» gjennom et redigeringsskjema ville gått utenom dem alle.
 * Tildeling har også sin egen knapp, av samme grunn.
 */

export type Ordreverdier = {
  title: string;
  description: string | null;
  type: string;
  priority: keyof typeof PRIORITET;
  assetId: string | null;
  dueDate: string;
  estimatedHours: number | null;
};

export function RedigerOrdre({
  ordreId,
  verdier,
  utstyr,
  typer,
}: {
  ordreId: string;
  verdier: Ordreverdier;
  utstyr: { id: string; code: string; name: string }[];
  /** Typene firmaet har satt opp. Se Oppsett. */
  typer: { code: string; name: string }[];
}) {
  const [apen, settApen] = useState(false);
  const [state, action] = useActionState(endreOrdre.bind(null, ordreId), {
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
      <Field label="Tittel" required hint="Det andre leter etter om ett år">
        <Input name="title" defaultValue={verdier.title} required />
      </Field>

      <Field label="Beskrivelse">
        <Textarea name="description" rows={4} defaultValue={verdier.description ?? ""} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="type" defaultValue={verdier.type} required>
            {/* Typen som står på ordren kan være fjernet fra lista siden.
                Uten dette valget ville skjemaet stille byttet den ut. */}
            {!typer.some((t) => t.code === verdier.type) && (
              <option value={verdier.type}>{verdier.type} (utgått)</option>
            )}
            {typer.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioritet" required>
          <Select name="priority" defaultValue={verdier.priority} required>
            {Object.entries(PRIORITET).map(([kode, p]) => (
              <option key={kode} value={kode}>
                {p.tekst}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Utstyr">
        <Select name="assetId" defaultValue={verdier.assetId ?? ""}>
          <option value="">Ikke knyttet til utstyr</option>
          {utstyr.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Frist">
          <Input name="dueDate" type="date" defaultValue={verdier.dueDate} />
        </Field>
        <Field label="Anslag i timer" hint="Brukes til å regne belegg i ukeplanen">
          <Input
            name="estimatedHours"
            type="number"
            step="0.5"
            min="0"
            defaultValue={verdier.estimatedHours ?? ""}
          />
        </Field>
      </div>

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
