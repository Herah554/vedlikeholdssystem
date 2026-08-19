"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, Select } from "@/components/ui";
import { felterFor, type Importtype } from "@/lib/import/felter";
import {
  analyser,
  utforImport,
  type Analyse,
  type Importsvar,
} from "./actions";

function Knapp({ tekst, venter }: { tekst: string; venter: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <ArrowRight className="size-4" aria-hidden />
      {pending ? venter : tekst}
    </Button>
  );
}

function Feil({ melding }: { melding: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{melding}</span>
    </div>
  );
}

export function Importskjema() {
  const [type, settType] = useState<Importtype>("utstyr");
  const [fil, settFil] = useState<File>();
  const [kobling, settKobling] = useState<Record<string, number>>({});

  const [analyse, analyserAction] = useActionState<Analyse, FormData>(analyser, {
    ok: false,
    feil: "",
  });
  const [svar, importAction] = useActionState<Importsvar, FormData>(
    utforImport,
    { ok: false, feil: "" },
  );

  const filfelt = useRef<HTMLInputElement>(null);
  const felter = felterFor(type);

  // Koblingen fra serveren gjelder til brukeren rører den selv
  const gjeldende = Object.keys(kobling).length
    ? kobling
    : analyse.ok
      ? analyse.kobling
      : {};

  function nullstill() {
    settFil(undefined);
    settKobling({});
    if (filfelt.current) filfelt.current.value = "";
  }

  // ── Ferdig ────────────────────────────────────────────────
  if (svar.ok) {
    return (
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Importen er ferdig
            </span>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-tekst">
                {svar.opprettet}
              </p>
              <p className="text-sm text-tekst-svak">opprettet</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-tekst">
                {svar.oppdatert}
              </p>
              <p className="text-sm text-tekst-svak">oppdatert</p>
            </div>
            <div>
              <p
                className={
                  svar.feil.length
                    ? "text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                    : "text-2xl font-semibold tabular-nums text-tekst"
                }
              >
                {svar.feil.length}
              </p>
              <p className="text-sm text-tekst-svak">hoppet over</p>
            </div>
          </div>

          {svar.feil.length > 0 && (
            <div className="rounded-lg bg-flate-dempet p-4">
              <p className="mb-2 text-sm font-medium text-tekst">
                Disse radene kom ikke inn
              </p>
              <ul className="space-y-1 text-sm text-tekst-svak">
                {svar.feil.slice(0, 25).map((f) => (
                  <li key={`${f.rad}-${f.melding}`}>
                    <span className="font-mono text-xs text-tekst-svakest">
                      linje {f.rad}
                    </span>{" "}
                    {f.melding}
                  </li>
                ))}
              </ul>
              {svar.feil.length > 25 && (
                <p className="mt-2 text-sm text-tekst-svak">
                  … og {svar.feil.length - 25} til.
                </p>
              )}
              <p className="mt-3 text-sm text-tekst-svak">
                Rett dem i regnearket og last opp fila på nytt. Radene som
                allerede kom inn blir oppdatert, ikke doblet.
              </p>
            </div>
          )}

          <Button type="button" variant="sekundær" onClick={() => location.reload()}>
            <Upload className="size-4" aria-hidden />
            Importer en fil til
          </Button>
        </CardBody>
      </Card>
    );
  }

  // ── Steg 2: koble kolonnene ───────────────────────────────
  if (analyse.ok && fil) {
    return (
      <form action={importAction} className="space-y-5">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="kobling" value={JSON.stringify(gjeldende)} />
        <FilIgjen fil={fil} />

        <Card>
          <CardHeader
            title="Hvilken kolonne er hva?"
            description={`${analyse.filnavn} — ${analyse.antallRader} rader. Vi har gjettet ut fra overskriftene, men se over.`}
          />
          <CardBody className="space-y-4">
            {!svar.ok && svar.feil && <Feil melding={svar.feil} />}

            {analyse.forKort && (
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                Fila har flere rader enn vi tar imot om gangen. De første
                5000 importeres — del opp resten i en ny fil.
              </div>
            )}

            <ul className="divide-y divide-kant">
              {felter.map((felt) => {
                const valgt = gjeldende[felt.id];
                return (
                  <li
                    key={felt.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium text-tekst">
                        {felt.navn}
                        {felt.påkrevd && (
                          <span className="ml-1 text-red-600 dark:text-red-400">
                            *
                          </span>
                        )}
                      </p>
                      {felt.hint && (
                        <p className="text-xs text-tekst-svak">{felt.hint}</p>
                      )}
                    </div>

                    <Select
                      className="w-auto py-1 text-sm"
                      aria-label={`Kolonne for ${felt.navn}`}
                      value={valgt === undefined ? "" : String(valgt)}
                      onChange={(e) =>
                        settKobling({
                          ...gjeldende,
                          [felt.id]:
                            e.target.value === ""
                              ? (undefined as unknown as number)
                              : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">— ikke med —</option>
                      {analyse.kolonner.map((k, i) => (
                        <option key={`${k}-${i}`} value={i}>
                          {k || `Kolonne ${i + 1}`}
                        </option>
                      ))}
                    </Select>

                    {valgt !== undefined && analyse.forsteRader[0]?.[valgt] && (
                      <span className="max-w-40 truncate text-xs text-tekst-svakest">
                        f.eks. {analyse.forsteRader[0][valgt]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Knapp tekst={`Importer ${analyse.antallRader} rader`} venter="Importerer …" />
              <Button type="button" variant="stille" onClick={nullstill}>
                Velg en annen fil
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    );
  }

  // ── Steg 1: velg fil ──────────────────────────────────────
  return (
    <form action={analyserAction} className="space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-tekst-svak" aria-hidden />
              Velg fil
            </span>
          }
          description="Excel eller CSV. Første rad må være overskrifter."
        />
        <CardBody className="space-y-4">
          {!analyse.ok && analyse.feil && <Feil melding={analyse.feil} />}

          <div>
            <label
              htmlFor="type"
              className="mb-1.5 block text-sm font-medium text-tekst"
            >
              Hva importerer du?
            </label>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(e) => settType(e.target.value as Importtype)}
            >
              <option value="utstyr">Utstyr og anlegg</option>
              <option value="deler">Reservedeler</option>
            </Select>
          </div>

          <div>
            <label
              htmlFor="fil"
              className="mb-1.5 block text-sm font-medium text-tekst"
            >
              Fil
            </label>
            <input
              ref={filfelt}
              id="fil"
              name="fil"
              type="file"
              required
              accept=".csv,.xlsx,.xlsm,.txt,text/csv"
              onChange={(e) => settFil(e.target.files?.[0])}
              className="block w-full text-sm text-tekst-svak file:mr-3 file:rounded-lg file:border-0 file:bg-flate-dempet file:px-3 file:py-2 file:text-sm file:font-medium file:text-tekst hover:file:bg-flate-hover"
            />
            <p className="mt-1.5 text-xs text-tekst-svak">
              Ingenting lagres før du har sett over koblingen i neste steg.
            </p>
          </div>

          <Knapp tekst="Les fila" venter="Leser …" />
        </CardBody>
      </Card>
    </form>
  );
}

/**
 * Legger fila inn i skjemaet for steg to.
 *
 * Et filfelt kan ikke fylles ut fra kode av sikkerhetsgrunner, så fila må
 * bæres med som en DataTransfer. Alternativet var å ta vare på tabellen på
 * serveren mellom to forespørsler, og det er mer å holde styr på.
 */
function FilIgjen({ fil }: { fil: File }) {
  return (
    <input
      type="file"
      name="fil"
      className="hidden"
      tabIndex={-1}
      aria-hidden
      ref={(el) => {
        if (!el) return;
        const dt = new DataTransfer();
        dt.items.add(fil);
        el.files = dt.files;
      }}
    />
  );
}
