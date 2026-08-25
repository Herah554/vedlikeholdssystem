"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Plus,
  Power,
  Save,
  Trash2,
} from "lucide-react";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { FELTTYPER, type Felt, type Felttype } from "@/lib/skjema";
import { lagreMalFelter, opprettMal, settMalAktiv, type Resultat } from "./maler-actions";

export type Mal = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  version: number;
  isActive: boolean;
  felter: Felt[];
  antallBrukt: number;
};

const BRUKSOMRADE: Record<string, string> = {
  ARBEIDSORDRE: "Arbeidsordre",
  AVVIK: "Avvik",
  BEGGE: "Begge",
};

function Knapp({ tekst, venter }: { tekst: string; venter: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? venter : tekst}
    </Button>
  );
}

/**
 * Redigering av feltene i én mal.
 *
 * Feltene holdes i nettleseren mens man jobber og sendes som JSON når man
 * lagrer. Å lagre etter hvert tastetrykk ville sendt hundrevis av
 * forespørsler, og å versjonere malen for hvert komma ville gjort
 * versjonsnummeret meningsløst.
 */
function Feltredigering({ mal }: { mal: Mal }) {
  const [felter, settFelter] = useState<Felt[]>(mal.felter);
  const [state, action] = useActionState<Resultat, FormData>(
    lagreMalFelter.bind(null, mal.id),
    { ok: true },
  );

  function endre(i: number, endring: Partial<Felt>) {
    settFelter((f) => f.map((el, n) => (n === i ? { ...el, ...endring } : el)));
  }

  function flytt(i: number, retning: -1 | 1) {
    const mål = i + retning;
    if (mål < 0 || mål >= felter.length) return;
    const kopi = [...felter];
    [kopi[i], kopi[mål]] = [kopi[mål], kopi[i]];
    settFelter(kopi);
  }

  function leggTil() {
    settFelter((f) => [
      ...f,
      {
        id: `f${Date.now().toString(36)}`,
        type: "tekst",
        etikett: "",
      },
    ]);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="felter" value={JSON.stringify(felter)} />

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Navn" required>
          <Input name="name" defaultValue={mal.name} required />
        </Field>
        <Field label="Forklaring">
          <Input name="description" defaultValue={mal.description ?? ""} />
        </Field>
      </div>

      <ul className="space-y-2">
        {felter.map((felt, i) => (
          <li
            key={felt.id}
            className="rounded-lg bg-flate-dempet p-3 ring-1 ring-kant ring-inset"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <Input
                aria-label={`Spørsmål ${i + 1}`}
                value={felt.etikett}
                onChange={(e) => endre(i, { etikett: e.target.value })}
                placeholder={
                  felt.type === "overskrift" ? "Navn på bolken" : "Spørsmålet"
                }
                className="py-1.5 text-sm"
              />

              <Select
                aria-label={`Type for spørsmål ${i + 1}`}
                value={felt.type}
                onChange={(e) =>
                  endre(i, { type: e.target.value as Felttype })
                }
                className="py-1.5 text-sm"
              >
                {FELTTYPER.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.navn}
                  </option>
                ))}
              </Select>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => flytt(i, -1)}
                  disabled={i === 0}
                  aria-label="Flytt opp"
                  className="rounded-md p-1.5 text-tekst-svak hover:text-tekst disabled:opacity-30"
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => flytt(i, 1)}
                  disabled={i === felter.length - 1}
                  aria-label="Flytt ned"
                  className="rounded-md p-1.5 text-tekst-svak hover:text-tekst disabled:opacity-30"
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    settFelter((f) => f.filter((_, n) => n !== i))
                  }
                  aria-label="Fjern"
                  className="rounded-md p-1.5 text-tekst-svak hover:text-red-600"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {felt.type !== "overskrift" && (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  aria-label="Hjelpetekst"
                  value={felt.hjelpetekst ?? ""}
                  onChange={(e) => endre(i, { hjelpetekst: e.target.value })}
                  placeholder="Hjelpetekst (valgfri)"
                  className="py-1.5 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-tekst-svak">
                  <input
                    type="checkbox"
                    checked={felt.pakrevd === true}
                    onChange={(e) => endre(i, { pakrevd: e.target.checked })}
                    className="size-4 rounded border-kant-sterk"
                  />
                  Må fylles ut
                </label>
              </div>
            )}

            {(felt.type === "valg" || felt.type === "flervalg") && (
              <Input
                aria-label="Valgene"
                value={(felt.valg ?? []).join(", ")}
                onChange={(e) =>
                  endre(i, {
                    valg: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Valgene, skilt med komma"
                className="mt-2 py-1.5 text-sm"
              />
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="sekundær" onClick={leggTil}>
          <Plus className="size-4" aria-hidden />
          Legg til felt
        </Button>

        <Knapp tekst="Lagre malen" venter="Lagrer …" />

        <span className="text-xs text-tekst-svak">
          Versjon {mal.version}
          {mal.antallBrukt > 0 &&
            ` · brukt på ${mal.antallBrukt} skjema, som ikke endres`}
        </span>
      </div>
    </form>
  );
}

export function Skjemamaler({ maler }: { maler: Mal[] }) {
  const [state, action] = useActionState<Resultat, FormData>(opprettMal, {
    ok: true,
  });
  const [apen, settApen] = useState<string>();

  return (
    <div className="space-y-5">
      {maler.length > 0 && (
        <ul className="space-y-2">
          {maler.map((m) => (
            <li key={m.id} className="rounded-lg ring-1 ring-kant ring-inset">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ClipboardList
                  className="size-4 shrink-0 text-tekst-svakest"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tekst">{m.name}</p>
                  <p className="text-xs text-tekst-svak">
                    {m.felter.length} felter · {BRUKSOMRADE[m.scope] ?? m.scope}
                    {m.description && ` · ${m.description}`}
                  </p>
                </div>

                {!m.isActive && (
                  <Badge className="bg-flate-dempet text-tekst-svak ring-kant-sterk">
                    ikke i bruk
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="sekundær"
                  onClick={() => settApen((f) => (f === m.id ? undefined : m.id))}
                >
                  {apen === m.id ? "Lukk" : "Rediger"}
                </Button>

                <form action={settMalAktiv}>
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="aktiv"
                    value={m.isActive ? "nei" : "ja"}
                  />
                  <Button type="submit" variant="stille">
                    <Power className="size-4" aria-hidden />
                    {m.isActive ? "Ta ut" : "Ta inn"}
                  </Button>
                </form>
              </div>

              {apen === m.id && (
                <div className="border-t border-kant px-4 py-4">
                  <Feltredigering mal={m} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 border-t border-kant pt-5">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Navn på malen" required>
            <Input name="name" required placeholder="SJA — sikker jobb-analyse" />
          </Field>

          <Field label="Forklaring">
            <Input name="description" placeholder="Fylles ut før farlig arbeid" />
          </Field>

          <Field label="Brukes på">
            <Select name="scope" defaultValue="ARBEIDSORDRE">
              <option value="ARBEIDSORDRE">Arbeidsordre</option>
              <option value="AVVIK">Avvik</option>
              <option value="BEGGE">Begge</option>
            </Select>
          </Field>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg bg-flate-dempet px-3 py-2.5">
          <input
            type="checkbox"
            name="sja"
            value="ja"
            defaultChecked
            className="mt-0.5 size-4 rounded border-kant-sterk"
          />
          <span className="text-sm">
            <span className="font-medium text-tekst">
              Start fra et ferdig SJA-forslag
            </span>
            <span className="block text-tekst-svak">
              Seksten felter som følger rekkefølgen en sikker jobb-analyse går
              i. Stryk det som ikke passer.
            </span>
          </span>
        </label>

        <Knapp tekst="Opprett mal" venter="Oppretter …" />
      </form>
    </div>
  );
}
