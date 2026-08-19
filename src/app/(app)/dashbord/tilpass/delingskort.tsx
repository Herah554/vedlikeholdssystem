"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Download, Share2, Users } from "lucide-react";
import { Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import type { DeltDashbord, Kollega } from "./deling";
import { delOppsett, taIBruk, type Resultat } from "./actions";

function DelKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Share2 className="size-4" aria-hidden />
      {pending ? "Lagrer …" : "Lagre deling"}
    </Button>
  );
}

/** Hvem som får se ditt oppsett. */
export function DelKort({
  kolleger,
  heleFirmaet: startHeleFirmaet,
  harEget,
}: {
  kolleger: Kollega[];
  heleFirmaet: boolean;
  harEget: boolean;
}) {
  const [state, action] = useActionState<Resultat, FormData>(delOppsett, {
    ok: true,
  });
  const [alle, settAlle] = useState(startHeleFirmaet);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Share2 className="size-4 text-tekst-svak" aria-hidden />
            Del oppsettet ditt
          </span>
        }
        description="De du deler med kan ta oppsettet i bruk som sitt eget. De ser dine tall for sin egen tilgang — ikke dine."
      />
      <CardBody>
        {!harEget ? (
          <p className="text-sm text-tekst-svak">
            Lagre ditt eget oppsett først. Da kan du dele det videre.
          </p>
        ) : (
          <form action={action} className="space-y-4">
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

            <label className="flex items-start gap-2.5 rounded-lg bg-flate-dempet px-3 py-2.5">
              <input
                type="checkbox"
                name="alle"
                value="ja"
                checked={alle}
                onChange={(e) => settAlle(e.target.checked)}
                className="mt-0.5 size-4 rounded border-kant-sterk"
              />
              <span className="text-sm">
                <span className="font-medium text-tekst">
                  Del med hele firmaet
                </span>
                <span className="block text-tekst-svak">
                  Også de som ansettes senere
                </span>
              </span>
            </label>

            {kolleger.length === 0 ? (
              <p className="text-sm text-tekst-svak">
                Du er foreløpig alene i dette firmaet.
              </p>
            ) : (
              <fieldset disabled={alle} className="space-y-1 disabled:opacity-40">
                <legend className="mb-2 text-sm font-medium text-tekst">
                  Eller velg hvem
                </legend>
                {kolleger.map((k) => (
                  <label
                    key={k.id}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="mottaker"
                      value={k.id}
                      defaultChecked={k.harTilgang}
                      className="size-4 rounded border-kant-sterk"
                    />
                    <span className="text-tekst">{k.navn}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <DelKnapp />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

/** Oppsett andre har delt med deg. */
export function MottattKort({ delte }: { delte: DeltDashbord[] }) {
  const [venter, start] = useTransition();
  const [feil, settFeil] = useState<string>();
  const router = useRouter();

  function bruk(id: string) {
    start(async () => {
      const svar = await taIBruk(id);
      settFeil(svar.ok ? undefined : svar.feil);
      if (svar.ok) router.push("/dashbord");
    });
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="size-4 text-tekst-svak" aria-hidden />
            Delt med deg
          </span>
        }
        description="Tar du et i bruk, blir det ditt eget. Endrer kollegaen sitt senere, står ditt som det er."
      />

      {delte.length === 0 ? (
        <EmptyState
          title="Ingen har delt et oppsett med deg ennå"
          description="Når noen deler dashbordet sitt, dukker det opp her."
        />
      ) : (
        <ul className="divide-y divide-kant">
          {feil && (
            <li
              role="alert"
              className="px-5 py-3 text-sm text-red-700 dark:text-red-400"
            >
              {feil}
            </li>
          )}
          {delte.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-tekst">{d.navn}</p>
                <p className="text-xs text-tekst-svak">
                  Fra {d.eier} · {d.antallWidgets} widgets
                  {d.medHeleFirmaet && " · delt med hele firmaet"}
                </p>
              </div>
              <Button
                type="button"
                variant="sekundær"
                disabled={venter}
                onClick={() => bruk(d.id)}
              >
                <Download className="size-4" aria-hidden />
                Ta i bruk
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
