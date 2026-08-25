"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Lock,
  LockOpen,
  Save,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";
import { framdrift, UTEN_SVAR, type Felt, type Svar } from "@/lib/skjema";
import {
  laasOppSkjema,
  laasSkjema,
  lagreSvar,
  slettSkjema,
  type Resultat,
} from "@/app/(app)/skjema/actions";

export type UtfyltSkjema = {
  id: string;
  navn: string;
  versjon: number;
  felter: Felt[];
  svar: Svar;
  laast: boolean;
  startetAv: string | null;
  laastAv: string | null;
  laastDato: string | null;
};

function LagreKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="sekundær" disabled={pending}>
      <Save className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Lagre"}
    </Button>
  );
}

/** Ett felt, enten som utfyllbart eller som ferdig svar. */
function Feltet({
  felt,
  svar,
  laast,
}: {
  felt: Felt;
  svar: Svar;
  laast: boolean;
}) {
  const verdi = svar[felt.id];

  if (felt.type === "overskrift") {
    return (
      <h4 className="mt-2 border-b border-kant pb-1.5 text-sm font-semibold text-tekst">
        {felt.etikett}
      </h4>
    );
  }

  // Et låst skjema er et dokument. Da vises svaret som tekst, ikke som et
  // felt som ser ut til å kunne endres.
  if (laast) {
    const vist =
      felt.type === "flervalg"
        ? Array.isArray(verdi) && verdi.length
          ? verdi.join(", ")
          : "—"
        : felt.type === "avkryssing"
          ? verdi === true
            ? "Ja"
            : "Nei"
          : verdi === null || verdi === undefined || verdi === ""
            ? "—"
            : String(verdi);

    return (
      <div>
        <p className="text-xs text-tekst-svak">{felt.etikett}</p>
        <p className="text-sm whitespace-pre-wrap text-tekst">{vist}</p>
      </div>
    );
  }

  const merke = (
    <span className="mb-1.5 block text-sm font-medium text-tekst">
      {felt.etikett}
      {felt.pakrevd && (
        <span className="ml-1 text-red-600 dark:text-red-400">*</span>
      )}
      {felt.hjelpetekst && (
        <span className="block text-xs font-normal text-tekst-svak">
          {felt.hjelpetekst}
        </span>
      )}
    </span>
  );

  if (felt.type === "langtekst") {
    return (
      <label className="block">
        {merke}
        <Textarea name={felt.id} rows={3} defaultValue={String(verdi ?? "")} />
      </label>
    );
  }

  if (felt.type === "ja_nei") {
    return (
      <label className="block">
        {merke}
        <Select name={felt.id} defaultValue={String(verdi ?? "")}>
          <option value="">— ikke besvart —</option>
          <option value="ja">Ja</option>
          <option value="nei">Nei</option>
          <option value="ikke-aktuelt">Ikke aktuelt</option>
        </Select>
      </label>
    );
  }

  if (felt.type === "avkryssing") {
    return (
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name={felt.id}
          value="ja"
          defaultChecked={verdi === true}
          className="mt-0.5 size-4 rounded border-kant-sterk"
        />
        <span className="text-sm text-tekst">
          {felt.etikett}
          {felt.pakrevd && (
            <span className="ml-1 text-red-600 dark:text-red-400">*</span>
          )}
        </span>
      </label>
    );
  }

  if (felt.type === "valg") {
    return (
      <label className="block">
        {merke}
        <Select name={felt.id} defaultValue={String(verdi ?? "")}>
          <option value="">— ikke besvart —</option>
          {(felt.valg ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </label>
    );
  }

  if (felt.type === "flervalg") {
    const valgte = Array.isArray(verdi) ? verdi : [];
    return (
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-tekst">
          {felt.etikett}
          {felt.pakrevd && (
            <span className="ml-1 text-red-600 dark:text-red-400">*</span>
          )}
        </legend>
        {felt.hjelpetekst && (
          <p className="mb-1.5 text-xs text-tekst-svak">{felt.hjelpetekst}</p>
        )}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(felt.valg ?? []).map((v) => (
            <label key={v} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name={felt.id}
                value={v}
                defaultChecked={valgte.includes(v)}
                className="mt-0.5 size-4 rounded border-kant-sterk"
              />
              <span className="text-tekst">{v}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="block">
      {merke}
      <Input
        name={felt.id}
        type={felt.type === "tall" ? "number" : felt.type === "dato" ? "date" : "text"}
        step={felt.type === "tall" ? "any" : undefined}
        defaultValue={
          felt.type === "dato" && typeof verdi === "string"
            ? verdi.slice(0, 10)
            : String(verdi ?? "")
        }
      />
    </label>
  );
}

export function Skjemautfylling({
  skjema,
  kanAdministrere,
}: {
  skjema: UtfyltSkjema;
  kanAdministrere: boolean;
}) {
  const [apen, settApen] = useState(!skjema.laast);
  const [state, action] = useActionState<Resultat, FormData>(
    lagreSvar.bind(null, skjema.id),
    { ok: true },
  );
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  const { utfylt, totalt } = framdrift(skjema.felter, skjema.svar);
  const synlige = skjema.felter.filter(
    (f) => !skjema.laast || !UTEN_SVAR.includes(f.type) || true,
  );

  function kjør(fn: () => Promise<Resultat>) {
    settFeil(undefined);
    start(async () => {
      const svar = await fn();
      if (!svar.ok) settFeil(svar.feil);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg ring-1 ring-kant ring-inset">
      <button
        type="button"
        onClick={() => settApen((f) => !f)}
        aria-expanded={apen}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-flate-hover"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-tekst-svak transition-transform ${apen ? "rotate-180" : ""}`}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-tekst">
            {skjema.navn}
          </span>
          <span className="block text-xs text-tekst-svak">
            {skjema.laast
              ? `Låst${skjema.laastAv ? ` av ${skjema.laastAv}` : ""}${
                  skjema.laastDato
                    ? ` ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" }).format(new Date(skjema.laastDato))}`
                    : ""
                }`
              : `${utfylt} av ${totalt} felter fylt ut`}
            {skjema.startetAv && !skjema.laast && ` · startet av ${skjema.startetAv}`}
          </span>
        </span>

        {skjema.laast ? (
          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
            <Lock className="size-3" aria-hidden />
            Låst
          </Badge>
        ) : (
          <Badge
            className={
              utfylt === totalt
                ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30"
                : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
            }
          >
            Utkast
          </Badge>
        )}
      </button>

      {apen && (
        <div className="border-t border-kant px-4 py-4">
          {(feil || state.feil) && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{feil ?? state.feil}</span>
            </div>
          )}

          {state.melding && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{state.melding}</span>
            </div>
          )}

          {skjema.laast ? (
            <div className="space-y-3">
              {synlige.map((felt) => (
                <Feltet key={felt.id} felt={felt} svar={skjema.svar} laast />
              ))}

              {kanAdministrere && (
                <div className="border-t border-kant pt-3">
                  <Button
                    type="button"
                    variant="stille"
                    disabled={venter}
                    onClick={() => kjør(() => laasOppSkjema(skjema.id))}
                  >
                    <LockOpen className="size-4" aria-hidden />
                    Lås opp
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <form action={action} className="space-y-4">
                {synlige.map((felt) => (
                  <Feltet
                    key={felt.id}
                    felt={felt}
                    svar={skjema.svar}
                    laast={false}
                  />
                ))}

                <div className="flex flex-wrap items-center gap-2 border-t border-kant pt-4">
                  <LagreKnapp />

                  <Button
                    type="button"
                    disabled={venter}
                    onClick={() => kjør(() => laasSkjema(skjema.id))}
                    title="Lagre svarene først. Låsing kan ikke gjøres om av alle."
                  >
                    <Lock className="size-4" aria-hidden />
                    Lås skjemaet
                  </Button>

                  {kanAdministrere && (
                    <Button
                      type="button"
                      variant="stille"
                      disabled={venter}
                      onClick={() => kjør(() => slettSkjema(skjema.id))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Slett
                    </Button>
                  )}
                </div>
              </form>

              <p className="mt-3 text-xs text-tekst-svak">
                Skjemaet låses automatisk når jobben lukkes. Da er det et
                dokument og kan ikke endres.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
