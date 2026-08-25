"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ChevronDown, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Utstyrsvelger, type Utstyrsvalg } from "@/components/utstyrsvelger";
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

/**
 * Skjemaet for en ny arbeidsordre.
 *
 * Delt i to med vilje. Den som melder en feil står som regel ute ved maskinen
 * med telefonen i hånda og trenger tre ting: hva er galt, hvilken maskin, og
 * haster det. Type, tildeling, timeanslag, frist og planlagt dato er
 * planleggerarbeid — nyttige felter, men i veien akkurat der og da.
 *
 * De ni feltene finnes fortsatt, ett klikk unna. Og de vises bare for den som
 * faktisk planlegger; en tekniker uten den rettigheten får dem ikke i det hele
 * tatt, siden serveren likevel ville satt dem til side.
 */
export function NyOrdreSkjema({
  utstyr,
  brukere,
  forvalgtUtstyr,
  kanPlanlegge,
}: {
  utstyr: Utstyrsvalg[];
  brukere: { id: string; name: string }[];
  forvalgtUtstyr?: string;
  kanPlanlegge: boolean;
}) {
  const [state, action] = useActionState<Resultat, FormData>(opprettOrdre, {
    ok: true,
  });
  const [visDetaljer, settVisDetaljer] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      {/* ── Det alle må fylle ut ────────────────────────────── */}

      <Field label="Hva er problemet?" required>
        <Input
          name="title"
          required
          autoFocus
          maxLength={200}
          placeholder="F.eks. Unormal lyd fra kjølevannspumpe"
        />
      </Field>

      <Utstyrsvelger
        utstyr={utstyr}
        start={forvalgtUtstyr}
        hint="La stå tom hvis jobben ikke gjelder en bestemt maskin"
      />

      <Field label="Haster det?" required>
        <Select name="priority" defaultValue="NORMAL" required>
          {PRIORITET_REKKEFOLGE.map((p) => (
            <option key={p} value={p}>
              {PRIORITET[p].tekst}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Beskrivelse"
        hint="Ta med symptomer, målinger og når det startet. Jo mer konkret, desto lettere finner andre saken igjen senere."
      >
        <Textarea
          name="description"
          rows={4}
          placeholder="Operatør meldte om kraftig vibrasjon under morgenskiftet. Vibrasjonsmåling viste 11,2 mm/s mot normalt 2,8 mm/s."
        />
      </Field>

      {/* ── Planleggerens felter ────────────────────────────── */}

      {kanPlanlegge && (
        <div className="border-t border-kant pt-4">
          <button
            type="button"
            onClick={() => settVisDetaljer((f) => !f)}
            aria-expanded={visDetaljer}
            className="flex w-full items-center gap-2 text-left text-sm font-medium text-tekst-svak hover:text-tekst"
          >
            <ChevronDown
              className={`size-4 transition-transform ${visDetaljer ? "rotate-180" : ""}`}
              aria-hidden
            />
            Planlegging
            <span className="font-normal text-tekst-svakest">
              — type, tildeling, timer og datoer
            </span>
          </button>

          {visDetaljer && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Type" required>
                <Select name="type" defaultValue="KORREKTIV" required>
                  {Object.entries(ORDRE_TYPE).map(([verdi, e]) => (
                    <option key={verdi} value={verdi}>
                      {e.tekst}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tildel til">
                <Select name="assignedToId" defaultValue="">
                  <option value="">Ikke tildelt ennå</option>
                  {brukere.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Anslåtte timer">
                <Input
                  name="estimatedHours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="2"
                />
              </Field>

              <Field label="Frist">
                <Input name="dueDate" type="date" />
              </Field>

              <Field label="Planlagt dato" hint="Dagen jobben skal gjøres">
                <Input name="plannedDate" type="date" />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Vises ikke typevalget, må verdien likevel med — ellers faller
          skjemaet gjennom valideringen på serveren. Korrektiv er riktig
          gjetning: en melding som hastet nok til å skrives inn, gjelder som
          regel noe som er i stykker. */}
      {(!kanPlanlegge || !visDetaljer) && (
        <input type="hidden" name="type" value="KORREKTIV" />
      )}

      <SendKnapp />
    </form>
  );
}
