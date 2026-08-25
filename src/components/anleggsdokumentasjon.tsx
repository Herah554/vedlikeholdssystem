"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import {
  lagreDokumentasjon,
  slettDokumentasjon,
  type Resultat,
} from "@/app/(app)/anlegg/dokumentasjon-actions";

export type Notat = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  skrevetAv: string | null;
  endret: string;
};

const norskDato = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" });

function LagreKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Lagrer …" : "Lagre"}
    </Button>
  );
}

/**
 * Dokumentasjon på ett stykke utstyr.
 *
 * Skjemaet er skjult til man trenger det. En liste med driftsinstrukser er
 * noe man leser mye oftere enn man skriver, og et alltid åpent skjema ville
 * dyttet innholdet nedover.
 */
export function Anleggsdokumentasjon({
  assetId,
  notater,
  kanEndre,
  kanSlette,
}: {
  assetId: string;
  notater: Notat[];
  kanEndre: boolean;
  kanSlette: boolean;
}) {
  const [state, action] = useActionState<Resultat, FormData>(
    lagreDokumentasjon.bind(null, assetId),
    { ok: true },
  );
  const [redigerer, settRedigerer] = useState<string | null>(null);

  const apen = redigerer !== null;
  const valgt = notater.find((n) => n.id === redigerer);

  return (
    <div className="space-y-4">
      {state.feil && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.feil}</span>
        </div>
      )}

      {state.melding && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.melding}</span>
        </div>
      )}

      {notater.length === 0 && !apen && (
        <p className="text-sm text-tekst-svak">
          Ingenting skrevet ned ennå. Driftsinstrukser og erfaringer som står
          her, kan assistenten finne igjen senere.
        </p>
      )}

      {notater.length > 0 && (
        <ul className="divide-y divide-kant rounded-lg ring-1 ring-kant ring-inset">
          {notater.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <BookOpen
                  className="mt-0.5 size-4 shrink-0 text-tekst-svakest"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-tekst">{n.title}</p>
                    {n.category && (
                      <Badge className="bg-flate-dempet text-tekst-svak ring-kant">
                        {n.category}
                      </Badge>
                    )}
                  </div>

                  <p className="mt-1 text-sm whitespace-pre-wrap text-tekst-svak">
                    {n.body}
                  </p>

                  <p className="mt-1.5 text-xs text-tekst-svakest">
                    {n.skrevetAv ? `${n.skrevetAv} · ` : ""}
                    {norskDato.format(new Date(n.endret))}
                  </p>
                </div>

                {kanEndre && (
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        settRedigerer((f) => (f === n.id ? null : n.id))
                      }
                      aria-label={`Rediger ${n.title}`}
                      className="rounded-md p-1.5 text-tekst-svak hover:text-tekst"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>

                    {kanSlette && (
                      <form action={slettDokumentasjon}>
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="assetId" value={assetId} />
                        <button
                          type="submit"
                          aria-label={`Slett ${n.title}`}
                          className="rounded-md p-1.5 text-tekst-svak hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </form>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {kanEndre && (
        <>
          {!apen ? (
            <Button
              type="button"
              variant="sekundær"
              onClick={() => settRedigerer("")}
            >
              <Plus className="size-4" aria-hidden />
              Skriv ned noe
            </Button>
          ) : (
            <form
              action={action}
              key={redigerer}
              className="space-y-4 border-t border-kant pt-4"
            >
              {valgt && <input type="hidden" name="id" value={valgt.id} />}

              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <Field label="Overskrift" required>
                  <Input
                    name="title"
                    required
                    defaultValue={valgt?.title ?? ""}
                    placeholder="Oppstart etter stopp"
                  />
                </Field>

                <Field label="Kategori" hint="Valgfri">
                  <Input
                    name="category"
                    defaultValue={valgt?.category ?? ""}
                    placeholder="Driftsinstruks"
                  />
                </Field>
              </div>

              <Field
                label="Teksten"
                required
                hint="Skriv som du ville forklart det til en ny kollega. Dette er det assistenten leter i."
              >
                <Textarea
                  name="body"
                  required
                  rows={6}
                  defaultValue={valgt?.body ?? ""}
                  placeholder={
                    "Steng ventil V-12 før pumpa startes, ellers slår vernet ut.\n" +
                    "Vent to minutter etter stopp før omstart — mykstarteren trenger tid.\n" +
                    "Normal vibrasjon er 2–3 mm/s. Over 6 er noe galt med lageret."
                  }
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <LagreKnapp />
                <Button
                  type="button"
                  variant="stille"
                  onClick={() => settRedigerer(null)}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
