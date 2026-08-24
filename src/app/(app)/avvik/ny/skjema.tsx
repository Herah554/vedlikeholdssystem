"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  AVVIK_ALVOR,
  AVVIK_ALVOR_REKKEFOLGE,
  AVVIK_TYPE,
  AVVIK_TYPE_FORKLARING,
} from "@/lib/domene";
import { meldAvvik, type Resultat } from "../actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <ShieldAlert className="size-4" aria-hidden />
      {pending ? "Sender …" : "Meld avvik"}
    </Button>
  );
}

export function AvviksSkjema({
  utstyr,
  naa,
}: {
  utstyr: { id: string; code: string; name: string }[];
  naa: string;
}) {
  const [state, action] = useActionState<Resultat, FormData>(meldAvvik, {
    ok: true,
  });

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

      <Field label="Hva skjedde?" required hint="Én setning som sier hva det gjelder">
        <Input
          name="title"
          required
          autoFocus
          placeholder="Nesten truffet av last fra truck ved port 2"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="type" defaultValue="HMS">
            {Object.entries(AVVIK_TYPE).map(([verdi, etikett]) => (
              <option key={verdi} value={verdi}>
                {etikett.tekst} — {AVVIK_TYPE_FORKLARING[verdi as keyof typeof AVVIK_TYPE_FORKLARING]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Alvorlighet" required hint="Hvor galt kunne det gått?">
          <Select name="severity" defaultValue="MIDDELS">
            {AVVIK_ALVOR_REKKEFOLGE.map((a) => (
              <option key={a} value={a}>
                {AVVIK_ALVOR[a].tekst}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Beskriv hendelsen"
        required
        hint="Hva skjedde, hvor og hvem var involvert. Skriv som du ville forklart det til en kollega."
      >
        <Textarea
          name="description"
          required
          rows={5}
          placeholder="Sto ved pakkelinja da trucken rygget ut fra port 2 uten å tute. Lasten svingte ut og passerte omtrent en halv meter fra meg. Ingen kom til skade."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Når skjedde det?" required>
          <Input name="occurredAt" type="datetime-local" required defaultValue={naa} />
        </Field>

        <Field label="Sted" hint="Hvis det ikke gjelder et bestemt utstyr">
          <Input name="location" placeholder="Port 2, lager" />
        </Field>
      </div>

      <Field label="Gjelder utstyr">
        <Select name="assetId" defaultValue="">
          <option value="">— ikke knyttet til utstyr —</option>
          {utstyr.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} · {u.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Hva ble gjort der og da?"
        hint="Strakstiltak. La det stå tomt hvis ingenting ble gjort."
      >
        <Textarea
          name="immediateAction"
          rows={3}
          placeholder="Stoppet trucken og snakket med sjåføren. Sperret av området til vi fikk ryddet."
        />
      </Field>

      <SendKnapp />
    </form>
  );
}
